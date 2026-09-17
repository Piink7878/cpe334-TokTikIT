import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Authorization API for Internal Notes", () => {
  let req1Cookie: string;
  let req1TicketId: number;
  let req1Id: string;
  let catId: number;
  let sysId: number;

  beforeAll(async () => {
    // Setup test users
    const passwordHash = await bcrypt.hash("Password123!", 12);
    const req1 = await prisma.user.create({ data: { email: "req-auth@test.com", fullName: "Req Auth", role: "REQUESTER", passwordHash, mustChangePassword: false, isActive: true } });

    req1Id = req1.id;

    // Login user
    const res = await request(app).post("/api/auth/login").send({ email: "req-auth@test.com", password: "Password123!" });
    req1Cookie = res.headers["set-cookie"]?.[0] || "";

    // Create Category and System
    const cat = await prisma.category.create({ data: { name: "Test Cat Auth" } });
    catId = cat.id;
    const sys = await prisma.relatedSystem.create({ data: { name: "Test Sys Auth" } });
    sysId = sys.id;

    // Create a ticket owned by req1
    const tkt = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-999002",
        summary: "Req Auth Ticket",
        description: "Test Desc",
        requesterId: req1.id,
        categoryId: cat.id,
        relatedSystemId: sys.id,
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "OPEN"
      }
    });
    req1TicketId = tkt.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.ticket.deleteMany({ where: { id: req1TicketId } });
    await prisma.category.deleteMany({ where: { id: catId } });
    await prisma.relatedSystem.deleteMany({ where: { id: sysId } });
    await prisma.user.deleteMany({ where: { id: req1Id } });
  });

  it("should return 403 Forbidden when Requester accesses GET /api/tickets/:id/internal-notes", async () => {
    const res = await request(app)
      .get(`/api/tickets/${req1TicketId}/internal-notes`)
      .set("Cookie", req1Cookie);

    expect(res.status).toBe(403);
  });

  it("should return 403 Forbidden when Requester accesses POST /api/tickets/:id/internal-notes", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/internal-notes`)
      .set("Cookie", req1Cookie)
      .send({ content: "Try to add note" });

    expect(res.status).toBe(403);
  });
});
