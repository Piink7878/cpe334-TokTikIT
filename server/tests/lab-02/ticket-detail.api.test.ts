import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("GET /api/tickets/:id", () => {
  let requester1: any;
  let requester2: any;
  let ticket1: any;
  let ticket2: any;

  beforeAll(async () => {
    // Ensure requesters exist
    requester1 = await prisma.developmentRequester.findFirst({ where: { id: 1 } });
    requester2 = await prisma.developmentRequester.findFirst({ where: { id: 2 } });
    
    if (!requester1 || !requester2) {
      throw new Error("Seed data not found for requesters");
    }

    const category = await prisma.category.findFirst();
    const relatedSystem = await prisma.relatedSystem.findFirst();

    ticket1 = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-TEST-000001",
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
        ticketNumber: "TKT-TEST-000002",
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
  });

  it("should return ticket details successfully if owned by requester", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1.id}`)
      .set("x-requester-id", requester1.id.toString());
    
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ticket1.id);
    expect(res.body.data.ticketNumber).toBe(ticket1.ticketNumber);
    expect(res.body.data.requester.id).toBe(requester1.id);
  });

  it("should return 403 Forbidden if ticket is owned by another requester", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket2.id}`) // ticket 2 is owned by requester 2
      .set("x-requester-id", requester1.id.toString()); // but requester 1 is trying to access it

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ACCESS");
  });

  it("should return 404 Not Found if ticket does not exist", async () => {
    const res = await request(app)
      .get(`/api/tickets/999999`)
      .set("x-requester-id", requester1.id.toString());
    
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 Bad Request if X-Requester-Id is missing", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1.id}`);
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
