import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Requester dashboard API (Lab 4 Issue 5, FR-13, BR-12, BR-13)", () => {
  const suffix = Date.now().toString();
  const password = "Password123!";
  let requester: any;
  let otherRequester: any;
  let emptyRequester: any;
  let staff: any;
  let admin: any;
  let cookies: Record<string, string> = {};
  let categoryId: number;
  let systemId: number;
  const ticketIds: number[] = [];
  let counter = 0;

  const login = async (email: string) => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    return res.headers["set-cookie"][0] as string;
  };

  const makeTicket = async (owner: any, status: string, updatedAt?: Date) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `RD-${suffix}-${counter++}`,
        summary: `Requester dashboard ticket ${counter}`,
        description: "Requester dashboard test",
        categoryId,
        relatedSystemId: systemId,
        requesterId: owner.id,
        currentStatus: status as any,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        ...(updatedAt ? { updatedAt } : {})
      }
    });
    ticketIds.push(ticket.id);
    return ticket;
  };

  const dashboard = (cookie?: string) => {
    const req = request(app).get("/api/dashboard/requester");
    return cookie ? req.set("Cookie", cookie) : req;
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    const mk = (role: any, name: string) =>
      prisma.user.create({ data: { email: `${name}_${suffix}@rd.local`, fullName: name, role, passwordHash, isActive: true } });
    requester = await mk("REQUESTER", "rdreq");
    otherRequester = await mk("REQUESTER", "rdother");
    emptyRequester = await mk("REQUESTER", "rdempty");
    staff = await mk("IT_STAFF", "rdstaff");
    admin = await mk("ADMIN", "rdadmin");
    for (const [key, user] of Object.entries({ requester, otherRequester, emptyRequester, staff, admin })) {
      cookies[key] = await login((user as any).email);
    }
    categoryId = (await prisma.category.findFirst())!.id;
    systemId = (await prisma.relatedSystem.findFirst())!.id;

    // One ticket per status for `requester`, plus a second ACTIVE one so counts are not all 1.
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED", "REJECTED", "OPEN"]) {
      await makeTicket(requester, status);
    }
    // Someone else's tickets must never be counted (BR-13).
    await makeTicket(otherRequester, "OPEN");
    await makeTicket(otherRequester, "WAITING_FOR_REQUESTER");
    await makeTicket(otherRequester, "RESOLVED");
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [requester.id, otherRequester.id, emptyRequester.id, staff.id, admin.id] } } });
  });

  describe("access control", () => {
    it("rejects unauthenticated requests with 401", async () => {
      expect((await dashboard()).status).toBe(401);
    });

    it.each(["staff", "admin"])("rejects %s with 403", async (key) => {
      const res = await dashboard(cookies[key]);
      expect(res.status).toBe(403);
    });
  });

  describe("metrics (AC-10)", () => {
    it("counts only the requester's own tickets by the specified status sets", async () => {
      const res = await dashboard(cookies.requester);
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.totalTickets).toBe(10);
      expect(d.activeTickets).toBe(4); // NEW, OPEN, IN_PROGRESS, OPEN
      expect(d.waitingForRequesterTickets).toBe(1);
      expect(d.resolvedOrClosedTickets).toBe(2); // CANCELLED and REJECTED are excluded
    });

    it("keeps each requester's numbers separate", async () => {
      const d = (await dashboard(cookies.otherRequester)).body.data;
      expect(d).toMatchObject({ totalTickets: 3, activeTickets: 1, waitingForRequesterTickets: 1, resolvedOrClosedTickets: 1 });
      expect(d.recentTickets.every((t: any) => t.ticketNumber.startsWith(`RD-${suffix}-`))).toBe(true);
      expect(d.recentTickets).toHaveLength(3);
    });
  });

  describe("recent tickets (BR-12)", () => {
    it("returns at most 5 tickets, newest update first, with the documented fields", async () => {
      // Dated after the tickets created in beforeAll so the ordering is unambiguous.
      const base = Date.now() + 3_600_000;
      await Promise.all([0, 1, 2].map((i) => makeTicket(requester, "OPEN", new Date(base + i * 1000))));
      const newest = await makeTicket(requester, "WAITING_FOR_REQUESTER", new Date(base + 10_000));

      const recent = (await dashboard(cookies.requester)).body.data.recentTickets;
      expect(recent).toHaveLength(5);
      expect(recent[0].id).toBe(newest.id);
      const times = recent.map((t: any) => new Date(t.updatedAt).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
      expect(Object.keys(recent[0]).sort()).toEqual(["currentStatus", "id", "itPriority", "ticketNumber", "title", "updatedAt"]);
      expect(recent[0]).toMatchObject({ ticketNumber: newest.ticketNumber, currentStatus: "WAITING_FOR_REQUESTER", itPriority: "MEDIUM" });
    });
  });

  describe("empty dashboard (AC-20)", () => {
    it("returns zero metrics and an empty recent list for a requester with no tickets", async () => {
      const res = await dashboard(cookies.emptyRequester);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        totalTickets: 0,
        activeTickets: 0,
        waitingForRequesterTickets: 0,
        resolvedOrClosedTickets: 0,
        recentTickets: []
      });
    });
  });

  describe("drill-down list filter (UI-Q7)", () => {
    const list = (query: string) => request(app).get(`/api/tickets?${query}`).set("Cookie", cookies.requester);

    it("accepts a comma-separated status list and returns only those statuses", async () => {
      const res = await list("status=NEW,OPEN,IN_PROGRESS&pageSize=50");
      expect(res.status).toBe(200);
      const statuses = new Set(res.body.data.map((t: any) => t.status));
      expect([...statuses].sort()).toEqual(["IN_PROGRESS", "NEW", "OPEN"]);
      expect(res.body.pagination.totalItems).toBe(res.body.data.length);
    });

    it("still accepts a single status", async () => {
      const res = await list("status=WAITING_FOR_REQUESTER");
      expect(res.status).toBe(200);
      expect(res.body.data.every((t: any) => t.status === "WAITING_FOR_REQUESTER")).toBe(true);
    });

    it("rejects an unknown status or priority with 400 instead of a server error", async () => {
      for (const query of ["status=NEW,BOGUS", "itPriority=URGENT", "requestedPriority=URGENT"]) {
        const res = await list(query);
        expect(res.status, query).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
