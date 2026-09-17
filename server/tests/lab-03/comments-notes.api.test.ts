import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Comments and Notes API Tests (Lab 3)", () => {
  let itStaffSessionCookie: string;
  let requesterSessionCookie: string;
  
  let reqId: string;
  let ticketId: number;

  beforeAll(async () => {
    const emails = ["cn-staff@example.com", "cn-req@example.com"];
    
    // Clean up
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const tickets = await prisma.ticket.findMany({ where: { OR: [{ requesterId: { in: userIds } }, { ownerId: { in: userIds } }] } });
      const ticketIds = tickets.map(t => t.id);
      
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("Password123!", 10);

    await prisma.user.create({
      data: { email: "cn-staff@example.com", fullName: "IT Staff", role: "IT_STAFF", passwordHash, isActive: true }
    });
    
    const req1 = await prisma.user.create({
      data: { email: "cn-req@example.com", fullName: "Requester", role: "REQUESTER", passwordHash, isActive: true }
    });
    reqId = req1.id;

    // Login
    const loginStaff = await request(app).post("/api/auth/login").send({ email: "cn-staff@example.com", password: "Password123!" });
    itStaffSessionCookie = loginStaff.headers["set-cookie"][0];

    const loginReq = await request(app).post("/api/auth/login").send({ email: "cn-req@example.com", password: "Password123!" });
    requesterSessionCookie = loginReq.headers["set-cookie"][0];
  });

  beforeEach(async () => {
    if (ticketId) {
        await prisma.internalNote.deleteMany({ where: { ticketId } });
        await prisma.publicComment.deleteMany({ where: { ticketId } });
        await prisma.ticket.deleteMany({ where: { id: ticketId } });
    }
    
    const cat = await prisma.category.findFirst();
    const sys = await prisma.relatedSystem.findFirst();
    
    const t = await prisma.ticket.create({
      data: {
        ticketNumber: "CN-TKT-" + Date.now(),
        summary: "Ticket CN",
        categoryId: cat!.id,
        relatedSystemId: sys!.id,
        requesterId: reqId,
        currentStatus: "NEW",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        description: "Test description"
      }
    });
    ticketId = t.id;
  });

  afterAll(async () => {
    const emails = ["cn-staff@example.com", "cn-req@example.com"];
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const tickets = await prisma.ticket.findMany({ where: { OR: [{ requesterId: { in: userIds } }, { ownerId: { in: userIds } }] } });
      const ticketIds = tickets.map(t => t.id);
      
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
  });

  describe("Public Comments", () => {
    it("should allow Requester to post and fetch a public comment", async () => {
      const res = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", requesterSessionCookie).send({ content: "This is a public comment" });
      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe("This is a public comment");
      
      const resGet = await request(app).get(`/api/tickets/${ticketId}/comments`).set("Cookie", requesterSessionCookie);
      expect(resGet.status).toBe(200);
      expect(resGet.body.data.length).toBe(1);
      expect(resGet.body.data[0].content).toBe("This is a public comment");
    });

    it("should reject empty content with 400", async () => {
      const res = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", requesterSessionCookie).send({ content: "   " });
      expect(res.status).toBe(400);
    });
  });

  describe("Internal Notes", () => {
    it("should allow IT Staff to post and fetch an internal note", async () => {
      const res = await request(app).post(`/api/tickets/${ticketId}/internal-notes`).set("Cookie", itStaffSessionCookie).send({ content: "This is an internal note" });
      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe("This is an internal note");
      
      const resGet = await request(app).get(`/api/tickets/${ticketId}/internal-notes`).set("Cookie", itStaffSessionCookie);
      expect(resGet.status).toBe(200);
      expect(resGet.body.data.length).toBe(1);
      expect(resGet.body.data[0].content).toBe("This is an internal note");
    });

    it("should reject empty content with 400", async () => {
      const res = await request(app).post(`/api/tickets/${ticketId}/internal-notes`).set("Cookie", itStaffSessionCookie).send({ content: "   " });
      expect(res.status).toBe(400);
    });
  });

  describe("Indicate Resolved Action", () => {
    it("should allow Requester to indicate problem resolved and append entries", async () => {
      const res = await request(app).post(`/api/tickets/${ticketId}/indicate-resolved`).set("Cookie", requesterSessionCookie);
      expect(res.status).toBe(200);

      const pc = await prisma.publicComment.findMany({ where: { ticketId } });
      expect(pc.length).toBe(1);
      expect(pc[0].content).toContain("resolved");

      const inote = await prisma.internalNote.findMany({ where: { ticketId } });
      expect(inote.length).toBe(1);
      expect(inote[0].content).toContain("indicated");
    });
  });
});
