import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { TEST_PASSWORD_HASH } from "./test-utils.js";

const prisma = getPrisma();

describe("GET /api/tickets/:id", () => {
  let agent1: ReturnType<typeof request.agent>;
  let agent2: ReturnType<typeof request.agent>;
  let requester1: any;
  let requester2: any;
  let ticket1: any;
  let ticket2: any;

  beforeAll(async () => {
    // Create requesters
    requester1 = await prisma.user.create({
      data: {
        email: "detail1@test.com",
        fullName: "Detail Requester 1",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true
      }
    });

    requester2 = await prisma.user.create({
      data: {
        email: "detail2@test.com",
        fullName: "Detail Requester 2",
        passwordHash: TEST_PASSWORD_HASH,
        role: "REQUESTER",
        isActive: true
      }
    });

    agent1 = request.agent(app);
    agent2 = request.agent(app);

    await agent1.post("/api/auth/login").send({ email: "detail1@test.com", password: "password" });
    await agent2.post("/api/auth/login").send({ email: "detail2@test.com", password: "password" });

    const category = await prisma.category.findFirst();
    const relatedSystem = await prisma.relatedSystem.findFirst();

    ticket1 = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${new Date().getFullYear()}-001001`,
        requesterId: requester1.id,
        categoryId: category!.id,
        relatedSystemId: relatedSystem!.id,
        summary: "Test Ticket 1",
        description: "Test description",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "NEW"
      }
    });

    ticket2 = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${new Date().getFullYear()}-001002`,
        requesterId: requester2.id,
        categoryId: category!.id,
        relatedSystemId: relatedSystem!.id,
        summary: "Test Ticket 2",
        description: "Test description",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "NEW"
      }
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { id: { in: [ticket1.id, ticket2.id] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [requester1.id, requester2.id] } }
    });
  });

  it("should return ticket details successfully if owned by requester", async () => {
    const res = await agent1.get(`/api/tickets/${ticket1.id}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ticket1.id);
    expect(res.body.data.ticketNumber).toBe(ticket1.ticketNumber);
    expect(res.body.data.requester.id).toBe(requester1.id);
  });

  it("should return 403 Forbidden if ticket is owned by another requester", async () => {
    const res = await agent1.get(`/api/tickets/${ticket2.id}`); // ticket 2 is owned by requester 2

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
  });

  it("should return 404 Not Found if ticket does not exist", async () => {
    const res = await agent1.get(`/api/tickets/999999`);
    
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 401 if unauthenticated", async () => {
    const res = await request(app).get(`/api/tickets/${ticket1.id}`);
    
    expect(res.status).toBe(401);
  });
});
