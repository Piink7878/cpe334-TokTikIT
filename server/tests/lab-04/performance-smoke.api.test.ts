import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

// Smoke baselines from tests.md section 3.10 (local database, warm connection).
const DASHBOARD_BUDGET_MS = 300;
const ACTIONS_BUDGET_MS = 200;
const STATUS_BUDGET_MS = 250;

async function timed(run: () => Promise<request.Response>): Promise<{ ms: number; res: request.Response }> {
  const start = performance.now();
  const res = await run();
  return { ms: performance.now() - start, res };
}

const stats = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { mean: samples.reduce((a, b) => a + b, 0) / samples.length, p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
};

describe("Performance smoke (Lab 4 Issue 6, TC-PRF-01..03)", () => {
  const suffix = Date.now().toString();
  const password = "Password123!";
  let requester: any;
  let staff: any;
  let cookies: Record<string, string> = {};
  let ticketId: number;
  let counter = 0;

  const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password })).headers["set-cookie"][0] as string;

  const makeTicket = async (status: string) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `PF-${suffix}-${counter++}`,
        summary: "Performance smoke ticket",
        description: "Performance smoke ticket description",
        categoryId: (await prisma.category.findFirst())!.id,
        relatedSystemId: (await prisma.relatedSystem.findFirst())!.id,
        requesterId: requester.id,
        currentStatus: status as any,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM"
      }
    });

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    requester = await prisma.user.create({ data: { email: `pfreq_${suffix}@pf.local`, fullName: "pfreq", role: "REQUESTER", passwordHash, isActive: true } });
    staff = await prisma.user.create({ data: { email: `pfstaff_${suffix}@pf.local`, fullName: "pfstaff", role: "IT_STAFF", passwordHash, isActive: true } });
    cookies.requester = await login(requester.email);
    cookies.staff = await login(staff.email);
    const ticket = await makeTicket("IN_PROGRESS");
    ticketId = ticket.id;
    for (let i = 0; i < 5; i++) {
      await prisma.actionTaken.create({ data: { ticketId, performedById: staff.id, description: `Action ${i}`, result: "ok", followUpRequired: false } });
    }
  });

  afterAll(async () => {
    await prisma.idempotencyRecord.deleteMany({ where: { ticketId } });
    await prisma.actionTaken.deleteMany({ where: { ticket: { requesterId: requester.id } } });
    await prisma.internalNote.deleteMany({ where: { ticket: { requesterId: requester.id } } });
    await prisma.ticket.deleteMany({ where: { requesterId: requester.id } });
    await prisma.user.deleteMany({ where: { id: { in: [requester.id, staff.id] } } });
  });

  it.each([
    ["requester", "/api/dashboard/requester"],
    ["staff", "/api/dashboard/staff"]
  ])("TC-PRF-01: the %s dashboard answers within the budget", async (role, path) => {
    await request(app).get(path).set("Cookie", cookies[role]); // warm-up (connection setup)
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { ms, res } = await timed(() => request(app).get(path).set("Cookie", cookies[role]));
      expect(res.status).toBe(200);
      samples.push(ms);
    }
    const { mean, p95 } = stats(samples);
    expect(mean, `mean ${mean.toFixed(0)}ms`).toBeLessThanOrEqual(DASHBOARD_BUDGET_MS);
    expect(p95, `p95 ${p95.toFixed(0)}ms`).toBeLessThanOrEqual(DASHBOARD_BUDGET_MS);
  });

  it("TC-PRF-02: listing and recording Actions Taken answer within the budget", async () => {
    await request(app).get(`/api/tickets/${ticketId}/actions-taken`).set("Cookie", cookies.staff); // warm-up
    const list = await timed(() => request(app).get(`/api/tickets/${ticketId}/actions-taken`).set("Cookie", cookies.staff));
    expect(list.res.status).toBe(200);
    expect(list.res.body.data.length).toBeGreaterThanOrEqual(5);
    expect(list.ms, `list ${list.ms.toFixed(0)}ms`).toBeLessThanOrEqual(ACTIONS_BUDGET_MS);

    const create = await timed(() =>
      request(app)
        .post(`/api/tickets/${ticketId}/actions-taken`)
        .set("Cookie", cookies.staff)
        .send({ description: "Smoke action", result: "Recorded", followUpRequired: false })
    );
    expect(create.res.status).toBe(201);
    expect(create.ms, `create ${create.ms.toFixed(0)}ms`).toBeLessThanOrEqual(ACTIONS_BUDGET_MS);
  });

  it("TC-PRF-03: a status transition (gate check + audit note) answers within the budget", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    await prisma.actionTaken.create({ data: { ticketId: ticket.id, performedById: staff.id, description: "Fix", result: "Done", followUpRequired: false } });

    const { ms, res } = await timed(() => request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set("Cookie", cookies.staff).send({ status: "RESOLVED" }));
    expect(res.status).toBe(200);
    expect(res.body.ticket.currentStatus).toBe("RESOLVED");
    expect(ms, `status ${ms.toFixed(0)}ms`).toBeLessThanOrEqual(STATUS_BUDGET_MS);
  });
});
