import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { app, buildStatusBreakdown } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

const UNRESOLVED = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
const ALL_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED", "REJECTED"];

// Other test files share this database and run in parallel, so global numbers can change between two reads.
// Holding a SHARE lock on the tables freezes their writers while the API and the oracle queries are read.
async function frozen<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('LOCK TABLE "Ticket", "ActionTaken" IN SHARE MODE');
      return fn(tx);
    },
    { timeout: 20_000, maxWait: 20_000 }
  );
}

describe("IT Staff dashboard API (Lab 4 Issue 5, FR-14, BR-12, BR-16)", () => {
  const suffix = Date.now().toString();
  const password = "Password123!";
  let staff: any;
  let staff2: any;
  let emptyStaff: any;
  let admin: any;
  let requester: any;
  const cookies: Record<string, string> = {};
  let categoryId: number;
  let systemId: number;
  const ticketIds: number[] = [];
  let counter = 0;

  const login = async (email: string) => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    return res.headers["set-cookie"][0] as string;
  };

  const makeTicket = async (
    status: string,
    opts: { owner?: any; priority?: string; updatedAt?: Date; category?: number } = {}
  ) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `SD-${suffix}-${counter++}`,
        summary: `Staff dashboard ticket ${counter}`,
        description: "Staff dashboard test",
        categoryId: opts.category ?? categoryId,
        relatedSystemId: systemId,
        requesterId: requester.id,
        ownerId: opts.owner?.id ?? null,
        currentStatus: status as any,
        requestedPriority: "MEDIUM",
        itPriority: (opts.priority ?? "MEDIUM") as any,
        ...(opts.updatedAt ? { updatedAt: opts.updatedAt } : {})
      }
    });
    ticketIds.push(ticket.id);
    return ticket;
  };

  const makeAction = (ticketId: number, data: { performedBy: any; assignedTo?: any; followUp?: boolean; at?: Date; description?: string }) =>
    prisma.actionTaken.create({
      data: {
        ticketId,
        performedById: data.performedBy.id,
        assignedToId: data.assignedTo?.id ?? null,
        description: data.description ?? "Checked the switch configuration",
        result: "Port re-enabled",
        followUpRequired: !!data.followUp,
        followUpNote: data.followUp ? "Verify after 24 hours" : null,
        ...(data.at ? { actionDateTime: data.at } : {})
      }
    });

  const dashboard = async (cookie: string) => (await request(app).get("/api/dashboard/staff").set("Cookie", cookie)).body.data;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    const mk = (role: any, name: string) =>
      prisma.user.create({ data: { email: `${name}_${suffix}@sd.local`, fullName: name, role, passwordHash, isActive: true } });
    staff = await mk("IT_STAFF", "sdstaff");
    staff2 = await mk("IT_STAFF", "sdstaff2");
    emptyStaff = await mk("IT_STAFF", "sdempty");
    admin = await mk("ADMIN", "sdadmin");
    requester = await mk("REQUESTER", "sdreq");
    for (const [key, user] of Object.entries({ staff, staff2, emptyStaff, admin, requester })) {
      cookies[key] = await login((user as any).email);
    }
    categoryId = (await prisma.category.findFirst())!.id;
    systemId = (await prisma.relatedSystem.findFirst())!.id;
  });

  afterAll(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [staff.id, staff2.id, emptyStaff.id, admin.id, requester.id] } } });
  });

  describe("access control", () => {
    it("rejects unauthenticated requests with 401 and Requesters with 403", async () => {
      expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
      expect((await request(app).get("/api/dashboard/staff").set("Cookie", cookies.requester)).status).toBe(403);
    });

    it("serves IT Staff and Administrators the same endpoint (BR-16)", async () => {
      for (const key of ["staff", "admin"]) {
        const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookies[key]);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body.data).sort()).toEqual([
          "criticalOrHighPriorityTickets",
          "currentUserActions",
          "myActiveTickets",
          "recentTickets",
          "statusBreakdown",
          "ticketsRequiringFollowUp",
          "unassignedTickets"
        ]);
      }
    });
  });

  describe("per-user metrics (AC-12, AC-20)", () => {
    it("counts My Active Tickets only for the caller and only in the four active statuses", async () => {
      for (const status of ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "NEW", "RESOLVED", "CLOSED", "CANCELLED", "REJECTED"]) {
        await makeTicket(status, { owner: staff });
      }
      await makeTicket("OPEN", { owner: staff2 });

      expect((await dashboard(cookies.staff)).myActiveTickets).toBe(4);
      expect((await dashboard(cookies.staff2)).myActiveTickets).toBe(1);
    });

    it("returns zero and an empty actions list for a technician with no tickets or actions", async () => {
      const d = await dashboard(cookies.emptyStaff);
      expect(d.myActiveTickets).toBe(0);
      expect(d.currentUserActions).toEqual([]);
    });
  });

  describe("current-user actions", () => {
    it("lists actions the user performed or is assigned to, newest first, capped at 5, with the documented fields", async () => {
      const ticket = await makeTicket("IN_PROGRESS", { owner: staff2 });
      const base = Date.now() - 3_600_000;
      const performed = await Promise.all([0, 1, 2, 3].map((i) => makeAction(ticket.id, { performedBy: staff, at: new Date(base + i * 1000) })));
      const assigned = await makeAction(ticket.id, { performedBy: staff2, assignedTo: staff, at: new Date(base + 10_000) });
      const olderAssigned = await makeAction(ticket.id, { performedBy: staff2, assignedTo: staff, at: new Date(base - 10_000) });
      const notMine = await makeAction(ticket.id, { performedBy: staff2, at: new Date(base + 20_000) });

      const actions = (await dashboard(cookies.staff)).currentUserActions;
      expect(actions).toHaveLength(5);
      expect(actions.map((a: any) => a.id)).toEqual([assigned.id, performed[3].id, performed[2].id, performed[1].id, performed[0].id]);
      expect(actions.map((a: any) => a.id)).not.toContain(notMine.id);
      expect(actions.map((a: any) => a.id)).not.toContain(olderAssigned.id);
      expect(Object.keys(actions[0]).sort()).toEqual(["actionDateTime", "description", "followUpRequired", "id", "result", "ticketId", "ticketNumber"]);
      expect(actions[0]).toMatchObject({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    });
  });

  describe("global metrics (spec §8.2)", () => {
    // Raw SQL written straight from the specification formulas, independent of the Prisma queries in the handler.
    const oracle = async (tx: Prisma.TransactionClient) => {
      const one = async (query: Prisma.Sql) => Number((await tx.$queryRaw<{ n: bigint }[]>(query))[0].n);
      return {
        unassigned: await one(Prisma.sql`SELECT COUNT(*) AS n FROM "Ticket" WHERE "ownerId" IS NULL AND "currentStatus" IN ('NEW','OPEN')`),
        urgent: await one(Prisma.sql`SELECT COUNT(*) AS n FROM "Ticket" WHERE "itPriority" IN ('CRITICAL','HIGH') AND "currentStatus" NOT IN ('RESOLVED','CLOSED','CANCELLED','REJECTED')`),
        followUp: await one(Prisma.sql`SELECT COUNT(DISTINCT t.id) AS n FROM "Ticket" t JOIN "ActionTaken" a ON a."ticketId" = t.id WHERE a."followUpRequired" = true AND t."currentStatus" NOT IN ('RESOLVED','CLOSED','CANCELLED','REJECTED')`),
        followUpRows: await one(Prisma.sql`SELECT COUNT(*) AS n FROM "Ticket" t JOIN "ActionTaken" a ON a."ticketId" = t.id WHERE a."followUpRequired" = true AND t."currentStatus" NOT IN ('RESOLVED','CLOSED','CANCELLED','REJECTED')`),
        byStatus: await tx.$queryRaw<{ s: string; n: bigint }[]>(Prisma.sql`SELECT "currentStatus"::text AS s, COUNT(*) AS n FROM "Ticket" GROUP BY 1`)
      };
    };

    beforeAll(async () => {
      // Tickets on both sides of every definition, including one with several follow-up actions (AC-13).
      await makeTicket("NEW", { priority: "CRITICAL" });
      await makeTicket("OPEN", { priority: "LOW" });
      await makeTicket("OPEN", { priority: "HIGH", owner: staff2 });
      await makeTicket("WAITING_FOR_REQUESTER", { priority: "HIGH" });
      await makeTicket("RESOLVED", { priority: "CRITICAL" });
      await makeTicket("CANCELLED", { priority: "CRITICAL" });
      const multi = await makeTicket("IN_PROGRESS", { owner: staff });
      for (let i = 0; i < 3; i++) await makeAction(multi.id, { performedBy: staff, followUp: true });
      const done = await makeTicket("RESOLVED", { owner: staff });
      await makeAction(done.id, { performedBy: staff, followUp: true });
      const noFollowUp = await makeTicket("OPEN", { owner: staff });
      await makeAction(noFollowUp.id, { performedBy: staff, followUp: false });
    });

    it("matches the specified definitions", async () => {
      const { d, o } = await frozen(async (tx) => ({
        d: (await request(app).get("/api/dashboard/staff").set("Cookie", cookies.staff)).body.data,
        o: await oracle(tx)
      }));

      expect(d.unassignedTickets).toBe(o.unassigned);
      expect(d.criticalOrHighPriorityTickets).toBe(o.urgent);
      expect(d.ticketsRequiringFollowUp).toBe(o.followUp);
      expect(Object.keys(d.statusBreakdown).sort()).toEqual([...ALL_STATUSES].sort());
      for (const status of ALL_STATUSES) {
        expect(d.statusBreakdown[status], status).toBe(Number(o.byStatus.find((r) => r.s === status)?.n ?? 0));
      }
    });

    it("lists every status in the breakdown, with 0 for statuses that have no tickets", () => {
      const breakdown = buildStatusBreakdown([{ currentStatus: "OPEN", _count: { _all: 2 } }]);
      expect(Object.keys(breakdown).sort()).toEqual([...ALL_STATUSES].sort());
      expect(breakdown.OPEN).toBe(2);
      expect(Object.entries(breakdown).filter(([status]) => status !== "OPEN").every(([, n]) => n === 0)).toBe(true);
    });

    it("counts tickets rather than follow-up actions (AC-13)", async () => {
      const { d, o } = await frozen(async (tx) => ({
        d: (await request(app).get("/api/dashboard/staff").set("Cookie", cookies.staff)).body.data,
        o: await oracle(tx)
      }));

      // Our ticket with three follow-up actions makes the row count exceed the ticket count.
      expect(o.followUpRows).toBeGreaterThan(o.followUp);
      expect(d.ticketsRequiringFollowUp).toBe(o.followUp);
    });
  });

  describe("recent queue tickets", () => {
    it("returns at most 5 unresolved tickets, newest update first, with the documented fields", async () => {
      // Dated in the future so tickets created by other test files cannot outrank these.
      const base = Date.now() + 24 * 3_600_000;
      const newest = await makeTicket("WAITING_FOR_REQUESTER", { owner: staff2, updatedAt: new Date(base + 60_000) });
      await makeTicket("RESOLVED", { updatedAt: new Date(base + 90_000) });
      await makeTicket("CLOSED", { updatedAt: new Date(base + 95_000) });
      const open: Awaited<ReturnType<typeof makeTicket>>[] = [];
      for (let i = 0; i < 6; i++) open.push(await makeTicket("OPEN", { updatedAt: new Date(base + i * 1000) }));

      const recent = (await dashboard(cookies.staff)).recentTickets;
      expect(recent).toHaveLength(5);
      expect(recent.every((t: any) => (UNRESOLVED as readonly string[]).includes(t.currentStatus))).toBe(true);
      const times = recent.map((t: any) => new Date(t.updatedAt).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
      expect(Object.keys(recent[0]).sort()).toEqual(["currentStatus", "id", "itPriority", "ownerId", "ticketNumber", "title", "updatedAt"]);
      // The RESOLVED and CLOSED tickets above are newer than all of these, yet must not appear.
      expect(recent.map((t: any) => t.id)).toEqual([newest.id, open[5].id, open[4].id, open[3].id, open[2].id]);
    });
  });

  describe("drill-down list filters (spec §8.2, UI-Q8)", () => {
    // A private category keeps these assertions independent of other tests' tickets.
    let category: { id: number };
    const list = (query: string, cookie = cookies.staff) =>
      request(app).get(`/api/staff/tickets?categoryId=${category.id}&limit=50&${query}`).set("Cookie", cookie);
    const numbers = (res: request.Response) => res.body.data.map((t: any) => t.ticketNumber);
    let byKey: Record<string, string>;

    beforeAll(async () => {
      category = await prisma.category.create({ data: { name: `SD drill-down ${suffix}` } });
      const mkT = async (key: string, status: string, opts: any = {}) => {
        const t = await makeTicket(status, { ...opts, category: category.id });
        byKey[key] = t.ticketNumber;
        return t;
      };
      byKey = {};
      await mkT("unassignedNew", "NEW");
      await mkT("unassignedOpen", "OPEN");
      await mkT("unassignedResolved", "RESOLVED");
      await mkT("mineInProgress", "IN_PROGRESS", { owner: staff });
      await mkT("mineClosed", "CLOSED", { owner: staff });
      await mkT("theirsOpen", "OPEN", { owner: staff2, priority: "CRITICAL" });
      await mkT("highWaiting", "WAITING_FOR_REQUESTER", { priority: "HIGH" });
      await mkT("lowReopened", "REOPENED", { priority: "LOW" });
      const followUpOpen = await mkT("followUpOpen", "OPEN", { owner: staff });
      await makeAction(followUpOpen.id, { performedBy: staff, followUp: true });
      await makeAction(followUpOpen.id, { performedBy: staff, followUp: true });
      const followUpResolved = await mkT("followUpResolved", "RESOLVED", { owner: staff });
      await makeAction(followUpResolved.id, { performedBy: staff, followUp: true });
    });

    afterAll(async () => {
      await prisma.actionTaken.deleteMany({ where: { ticket: { categoryId: category.id } } });
      await prisma.ticket.deleteMany({ where: { categoryId: category.id } });
      await prisma.category.delete({ where: { id: category.id } });
    });

    it("status accepts a comma-separated list (Unassigned card: ownerId=unassigned&status=NEW,OPEN)", async () => {
      const res = await list("ownerId=unassigned&status=NEW,OPEN");
      expect(res.status).toBe(200);
      expect(numbers(res).sort()).toEqual([byKey.unassignedNew, byKey.unassignedOpen].sort());
    });

    it("ownerId=me resolves to the caller (My Active card)", async () => {
      const res = await list("ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED");
      expect(numbers(res).sort()).toEqual([byKey.mineInProgress, byKey.followUpOpen].sort());
      const asStaff2 = await list("ownerId=me", cookies.staff2);
      expect(numbers(asStaff2)).toEqual([byKey.theirsOpen]);
    });

    it("itPriority accepts a list (Critical / High card)", async () => {
      const res = await list(`itPriority=CRITICAL,HIGH&status=${UNRESOLVED.join(",")}`);
      expect(numbers(res).sort()).toEqual([byKey.theirsOpen, byKey.highWaiting].sort());
    });

    it("followUpRequired=true keeps each matching ticket once and honours the status set (Follow-Up card)", async () => {
      const res = await list(`followUpRequired=true&status=${UNRESOLVED.join(",")}`);
      expect(numbers(res)).toEqual([byKey.followUpOpen]);
      const all = await list("followUpRequired=true");
      expect(numbers(all).sort()).toEqual([byKey.followUpOpen, byKey.followUpResolved].sort());
      expect(all.body.pagination.totalItems).toBe(2);
    });

    it("ignores followUpRequired=false and leaves single-value filters unchanged", async () => {
      expect((await list("followUpRequired=false")).body.pagination.totalItems).toBe(Object.keys(byKey).length);
      expect(numbers(await list("status=CLOSED"))).toEqual([byKey.mineClosed]);
      expect(numbers(await list("itPriority=LOW"))).toEqual([byKey.lowReopened]);
    });

    it("rejects unknown status or priority values with 400 instead of a server error", async () => {
      for (const query of ["status=OPEN,BOGUS", "status=BOGUS", "itPriority=URGENT", "itPriority=HIGH,"]) {
        const res = await list(query);
        expect(res.status, query).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
