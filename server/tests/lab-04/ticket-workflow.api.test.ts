import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

// specification.md §6.1 — the single approved transition matrix.
const MATRIX: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED", "REJECTED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "OPEN", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
  REJECTED: []
};
const ALL_STATUSES = Object.keys(MATRIX);
const TERMINAL = ["CLOSED", "CANCELLED", "REJECTED"];

describe("Ticket workflow and Resolution Gate API (Lab 4 Issue 4)", () => {
  const suffix = Date.now().toString();
  const password = "Password123!";
  let staff: any;
  let staff2: any;
  let admin: any;
  let requester: any;
  let staffCookie: string;
  let adminCookie: string;
  let requesterCookie: string;
  let categoryId: number;
  let systemId: number;
  const ticketIds: number[] = [];
  let counter = 0;

  const login = async (email: string) => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    return res.headers["set-cookie"][0] as string;
  };

  const makeTicket = async (status: string, opts: { withAction?: boolean; followUp?: boolean } = {}) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `WF-${suffix}-${counter++}`,
        summary: "Workflow test ticket",
        description: "Workflow test ticket description",
        categoryId,
        relatedSystemId: systemId,
        requesterId: requester.id,
        currentStatus: status as any,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM"
      }
    });
    ticketIds.push(ticket.id);
    if (opts.withAction) {
      await prisma.actionTaken.create({
        data: {
          ticketId: ticket.id,
          performedById: staff.id,
          description: "Replaced the faulty switch",
          result: "Link restored",
          followUpRequired: !!opts.followUp,
          followUpNote: opts.followUp ? "Monitor for 24 hours" : null
        }
      });
    }
    return ticket;
  };

  const setStatus = (id: number, body: any, cookie = staffCookie) =>
    request(app).patch(`/api/staff/tickets/${id}/status`).set("Cookie", cookie).send(body);

  const statusOf = async (id: number) => (await prisma.ticket.findUnique({ where: { id } }))!.currentStatus;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    const mk = (role: any, name: string) =>
      prisma.user.create({
        data: { email: `${name}_${suffix}@wf.local`, fullName: name, role, passwordHash, isActive: true }
      });
    staff = await mk("IT_STAFF", "wfstaff1");
    staff2 = await mk("IT_STAFF", "wfstaff2");
    admin = await mk("ADMIN", "wfadmin");
    requester = await mk("REQUESTER", "wfrequester");
    staffCookie = await login(staff.email);
    adminCookie = await login(admin.email);
    requesterCookie = await login(requester.email);
    categoryId = (await prisma.category.findFirst())!.id;
    systemId = (await prisma.relatedSystem.findFirst())!.id;
  });

  afterAll(async () => {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [staff.id, staff2.id, admin.id, requester.id] } } });
  });

  describe("Resolution Gate (BR-10)", () => {
    it("rejects RESOLVED with ACTION_TAKEN_REQUIRED when the ticket has no Action Taken, and leaves it untouched", async () => {
      const ticket = await makeTicket("IN_PROGRESS");
      const res = await setStatus(ticket.id, { status: "RESOLVED" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: { code: "ACTION_TAKEN_REQUIRED", message: "At least one Action Taken is required." } });
      expect(await statusOf(ticket.id)).toBe("IN_PROGRESS");
      expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(0);
    });

    it("applies the gate to every predecessor of RESOLVED, for IT Staff and Admin alike", async () => {
      for (const from of ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]) {
        for (const cookie of [staffCookie, adminCookie]) {
          const ticket = await makeTicket(from);
          const res = await setStatus(ticket.id, { status: "RESOLVED" }, cookie);
          expect(res.status, `${from} without action`).toBe(400);
          expect(res.body.error.code).toBe("ACTION_TAKEN_REQUIRED");
        }
      }
    });

    it("allows RESOLVED once an Action Taken exists, even when its follow-up is still pending", async () => {
      const ticket = await makeTicket("IN_PROGRESS", { withAction: true, followUp: true });
      const res = await setStatus(ticket.id, { status: "RESOLVED" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Status updated successfully");
      expect(res.body.ticket.currentStatus).toBe("RESOLVED");
      const notes = await prisma.internalNote.findMany({ where: { ticketId: ticket.id } });
      expect(notes.map((n) => n.content)).toEqual(["Status changed from IN_PROGRESS to RESOLVED"]);
    });

    it("does not apply the gate to other transitions", async () => {
      const ticket = await makeTicket("OPEN");
      const res = await setStatus(ticket.id, { status: "IN_PROGRESS" });
      expect(res.status).toBe(200);
    });

    it("blocks a Requester from setting any status directly (403)", async () => {
      const ticket = await makeTicket("IN_PROGRESS", { withAction: true });
      const res = await setStatus(ticket.id, { status: "RESOLVED" }, requesterCookie);
      expect(res.status).toBe(403);
      expect(await statusOf(ticket.id)).toBe("IN_PROGRESS");
    });

    it("keeps the Requester's 'problem appears resolved' indication advisory (BR-11)", async () => {
      const ticket = await makeTicket("IN_PROGRESS", { withAction: true });
      const res = await request(app).post(`/api/tickets/${ticket.id}/indicate-resolved`).set("Cookie", requesterCookie);
      expect(res.status).toBe(200);
      expect(await statusOf(ticket.id)).toBe("IN_PROGRESS");
    });
  });

  describe("Transition matrix (§6.1)", () => {
    const listed = ALL_STATUSES.flatMap((from) => MATRIX[from].map((to) => [from, to]));
    const unlisted = ALL_STATUSES.flatMap((from) =>
      ALL_STATUSES.filter((to) => !MATRIX[from].includes(to)).map((to) => [from, to])
    );

    it.each(listed)("allows %s -> %s and writes an audit note", async (from, to) => {
      const ticket = await makeTicket(from, { withAction: true });
      const body: any = { status: to };
      if (to === "REJECTED") body.rejectionReason = "Out of scope request.";
      const res = await setStatus(ticket.id, body);

      expect(res.status).toBe(200);
      expect(await statusOf(ticket.id)).toBe(to);
      const note = await prisma.internalNote.findFirst({ where: { ticketId: ticket.id } });
      expect(note!.authorId).toBe(staff.id);
      expect(note!.content).toBe(
        to === "REJECTED" ? "Status changed from NEW to REJECTED. Reason: Out of scope request." : `Status changed from ${from} to ${to}`
      );
    });

    it("rejects every unlisted transition with the Lab 3 VALIDATION_ERROR code (BR-17) and leaves the status unchanged", async () => {
      const failures: string[] = [];
      for (const [from, to] of unlisted) {
        const ticket = await makeTicket(from, { withAction: true });
        const res = await setStatus(ticket.id, { status: to, rejectionReason: "reason" });
        const unchanged = (await statusOf(ticket.id)) === from;
        if (res.status !== 400 || res.body?.error?.code !== "VALIDATION_ERROR" || !unchanged) {
          failures.push(`${from} -> ${to}: ${res.status} ${res.body?.error?.code}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it("rejects an unknown status value", async () => {
      const ticket = await makeTicket("OPEN");
      const res = await setStatus(ticket.id, { status: "BOGUS" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("requires a rejection reason for NEW -> REJECTED (Lab 3 VALIDATION_ERROR code, BR-17)", async () => {
      const ticket = await makeTicket("NEW");
      for (const body of [{ status: "REJECTED" }, { status: "REJECTED", rejectionReason: "   " }]) {
        const res = await setStatus(ticket.id, body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
      expect(await statusOf(ticket.id)).toBe("NEW");
    });
  });

  describe("Terminal immutability (BR-08)", () => {
    it.each(TERMINAL)("rejects status, claim, assign and priority changes on a %s ticket", async (status) => {
      const ticket = await makeTicket(status, { withAction: true });

      const statusRes = await setStatus(ticket.id, { status: "OPEN" });
      expect(statusRes.status).toBe(400);

      const claim = await request(app).patch(`/api/staff/tickets/${ticket.id}/claim`).set("Cookie", staffCookie);
      expect(claim.status).toBe(400);
      expect(claim.body.error.code).toBe("TICKET_TERMINAL");

      const assign = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/assign`)
        .set("Cookie", staffCookie)
        .send({ assigneeId: staff2.id });
      expect(assign.status).toBe(400);
      expect(assign.body.error.code).toBe("TICKET_TERMINAL");

      const priority = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/priority`)
        .set("Cookie", staffCookie)
        .send({ itPriority: "CRITICAL" });
      expect(priority.status).toBe(400);
      expect(priority.body.error.code).toBe("TICKET_TERMINAL");

      const after = (await prisma.ticket.findUnique({ where: { id: ticket.id } }))!;
      expect(after.currentStatus).toBe(status);
      expect(after.ownerId).toBeNull();
      expect(after.itPriority).toBe("MEDIUM");
    });

    it("still allows claim, assign and priority on a non-terminal ticket", async () => {
      const ticket = await makeTicket("RESOLVED");
      const claim = await request(app).patch(`/api/staff/tickets/${ticket.id}/claim`).set("Cookie", staffCookie);
      expect(claim.status).toBe(200);
      const priority = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/priority`)
        .set("Cookie", staffCookie)
        .send({ itPriority: "HIGH" });
      expect(priority.status).toBe(200);
    });
  });

  describe("Claim, assign and priority racing with a status change (BR-08, BR-14)", () => {
    const attempts: [string, (id: number) => request.Test][] = [
      ["claim", (id) => request(app).patch(`/api/staff/tickets/${id}/claim`).set("Cookie", staffCookie)],
      ["assign", (id) => request(app).patch(`/api/staff/tickets/${id}/assign`).set("Cookie", staffCookie).send({ assigneeId: staff2.id })],
      ["priority", (id) => request(app).patch(`/api/staff/tickets/${id}/priority`).set("Cookie", staffCookie).send({ itPriority: "CRITICAL" })]
    ];

    // The request reads the ticket, then waits on the row lock; meanwhile another request changes the status.
    const raceWithStatusChange = async (id: number, makeRequest: (id: number) => request.Test, newStatus: string) => {
      let pending: Promise<request.Response> = Promise.resolve({} as request.Response);
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
        pending = makeRequest(id).then((r) => r);
        await new Promise((resolve) => setTimeout(resolve, 400));
        await tx.ticket.update({ where: { id }, data: { currentStatus: newStatus as any } });
      });
      return pending;
    };

    it.each(attempts)("%s cannot touch a ticket that became CANCELLED after it was validated", async (_name, makeRequest) => {
      const ticket = await makeTicket("NEW");
      const res = await raceWithStatusChange(ticket.id, makeRequest, "CANCELLED");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("TICKET_TERMINAL");
      const after = (await prisma.ticket.findUnique({ where: { id: ticket.id } }))!;
      expect(after.currentStatus).toBe("CANCELLED");
      expect(after.ownerId).toBeNull();
      expect(after.itPriority).toBe("MEDIUM");
      expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(0);
    });

    it.each(attempts.slice(0, 2))("%s does not overwrite a status that moved on from NEW in the meantime", async (_name, makeRequest) => {
      const ticket = await makeTicket("NEW");
      const res = await raceWithStatusChange(ticket.id, makeRequest, "IN_PROGRESS");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONCURRENCY_CONFLICT");
      const after = (await prisma.ticket.findUnique({ where: { id: ticket.id } }))!;
      expect(after.currentStatus).toBe("IN_PROGRESS");
      expect(after.ownerId).toBeNull();
    });
  });

  describe("Concurrent and stale status updates (BR-14, AC-15, requirements §6.1)", () => {
    it("lets exactly one of several competing transitions win and answers the rest with 409", async () => {
      const ticket = await makeTicket("IN_PROGRESS", { withAction: true });
      const expectedUpdatedAt = ticket.updatedAt.toISOString();
      // Hold the ticket row locked while the requests arrive: every handler reads the ticket and validates against
      // the same state, then waits on the lock. Only the in-transaction compare-and-set can pick a single winner.
      const targets = ["RESOLVED", "WAITING_FOR_REQUESTER", "OPEN", "CANCELLED", "RESOLVED", "WAITING_FOR_REQUESTER", "OPEN", "CANCELLED"];
      let pending: Promise<request.Response[]> = Promise.resolve([]);
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticket.id} FOR UPDATE`;
        pending = Promise.all(
          targets.map((status, i) => setStatus(ticket.id, { status, expectedUpdatedAt }, i % 2 ? adminCookie : staffCookie))
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      });
      const responses = await pending;

      // Asserting the whole status list makes any unexpected response (e.g. a 500) visible in the failure output.
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409, 409, 409, 409]);
      const winners = responses.filter((r) => r.status === 200);
      const losers = responses.filter((r) => r.status !== 200);
      expect(losers.every((r) => r.status === 409 && r.body.error.code === "CONCURRENCY_CONFLICT")).toBe(true);
      expect(await statusOf(ticket.id)).toBe(winners[0].body.ticket.currentStatus);
      expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(1);
    });

    it("rejects a stale update with 409 even when the transition is still permitted", async () => {
      const ticket = await makeTicket("OPEN", { withAction: true });
      const seen = ticket.updatedAt.toISOString();
      expect((await setStatus(ticket.id, { status: "IN_PROGRESS", expectedUpdatedAt: seen })).status).toBe(200);

      const stale = await setStatus(ticket.id, { status: "WAITING_FOR_REQUESTER", expectedUpdatedAt: seen });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe("CONCURRENCY_CONFLICT");
      expect(await statusOf(ticket.id)).toBe("IN_PROGRESS");
    });

    it("accepts the current expectedUpdatedAt and rejects a malformed one", async () => {
      const ticket = await makeTicket("OPEN");
      const bad = await setStatus(ticket.id, { status: "IN_PROGRESS", expectedUpdatedAt: "not-a-date" });
      expect(bad.status).toBe(400);
      const ok = await setStatus(ticket.id, { status: "IN_PROGRESS", expectedUpdatedAt: ticket.updatedAt.toISOString() });
      expect(ok.status).toBe(200);
    });
  });
});
