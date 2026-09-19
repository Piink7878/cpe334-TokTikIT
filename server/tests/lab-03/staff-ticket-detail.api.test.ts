import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("IT Staff Ticket Detail API (Lab 3)", () => {
  let itStaffSessionCookie: string;
  let adminSessionCookie: string;
  let requesterSessionCookie: string;
  let itStaffId: string;
  let adminId: string;
  let testTicketId: number;

  beforeAll(async () => {
    const emails = ["staff-detail@example.com", "admin-detail@example.com", "req-detail@example.com"];
    
    // Clean up from previous failed runs just in case
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

    const itStaff = await prisma.user.create({
      data: { email: "staff-detail@example.com", fullName: "IT Staff", role: "IT_STAFF", passwordHash, isActive: true }
    });
    itStaffId = itStaff.id;

    const admin = await prisma.user.create({
      data: { email: "admin-detail@example.com", fullName: "Admin", role: "ADMIN", passwordHash, isActive: true }
    });
    adminId = admin.id;

    const requester = await prisma.user.create({
      data: { email: "req-detail@example.com", fullName: "Requester", role: "REQUESTER", passwordHash, isActive: true }
    });

    // Login to get cookies
    const loginStaff = await request(app).post("/api/auth/login").send({ email: "staff-detail@example.com", password: "Password123!" });
    itStaffSessionCookie = loginStaff.headers["set-cookie"][0];

    const loginAdmin = await request(app).post("/api/auth/login").send({ email: "admin-detail@example.com", password: "Password123!" });
    adminSessionCookie = loginAdmin.headers["set-cookie"][0];

    const loginReq = await request(app).post("/api/auth/login").send({ email: "req-detail@example.com", password: "Password123!" });
    requesterSessionCookie = loginReq.headers["set-cookie"][0];
  });

  beforeEach(async () => {
    if (testTicketId) {
      await prisma.internalNote.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.publicComment.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.attachment.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    }
    
    const cat = await prisma.category.findFirst();
    const sys = await prisma.relatedSystem.findFirst();

    const requester = await prisma.user.findUnique({ where: { email: "req-detail@example.com" } });
    
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: "INC-DTL-" + Date.now(),
        summary: "Test Ticket",
        description: "Test Desc",
        categoryId: cat!.id,
        relatedSystemId: sys!.id,
        requesterId: requester!.id,
        currentStatus: "NEW",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM"
      }
    });
    testTicketId = ticket.id;
  });

  afterAll(async () => {
    const emails = ["staff-detail@example.com", "admin-detail@example.com", "req-detail@example.com"];
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

  describe("GET /api/staff/tickets/:id", () => {
    it("should allow IT Staff to view ticket detail", async () => {
      const res = await request(app).get(`/api/staff/tickets/${testTicketId}`).set("Cookie", itStaffSessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testTicketId);
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app).get(`/api/staff/tickets/${testTicketId}`);
      expect(res.status).toBe(401);
    });

    it("should reject Requester with 403 Forbidden", async () => {
      const res = await request(app).get(`/api/staff/tickets/${testTicketId}`).set("Cookie", requesterSessionCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/staff/tickets/:id/claim", () => {
    it("should allow IT Staff to claim and shift NEW to OPEN, and log the transition", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/claim`).set("Cookie", itStaffSessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.ticket.ownerId).toBe(itStaffId);
      expect(res.body.ticket.currentStatus).toBe("OPEN");

      const notes = await prisma.internalNote.findMany({ where: { ticketId: testTicketId } });
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe("Status changed from NEW to OPEN");
      expect(notes[0].authorId).toBe(itStaffId);
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/claim`);
      expect(res.status).toBe(401);
    });

    it("should reject Requester with 403 Forbidden", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/claim`).set("Cookie", requesterSessionCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/staff/tickets/:id/assign", () => {
    it("should allow Admin to assign to IT Staff, and log the NEW to OPEN transition", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/assign`)
        .set("Cookie", adminSessionCookie)
        .send({ assigneeId: itStaffId });
      expect(res.status).toBe(200);
      expect(res.body.ticket.ownerId).toBe(itStaffId);
      expect(res.body.ticket.currentStatus).toBe("OPEN");

      const notes = await prisma.internalNote.findMany({ where: { ticketId: testTicketId } });
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe("Status changed from NEW to OPEN");
      expect(notes[0].authorId).toBe(adminId);
    });

    it("should reject invalid assignee", async () => {
      const reqUser = await prisma.user.findUnique({ where: { email: "req-detail@example.com" } });
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/assign`)
        .set("Cookie", itStaffSessionCookie)
        .send({ assigneeId: reqUser!.id });
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/assign`)
        .send({ assigneeId: itStaffId });
      expect(res.status).toBe(401);
    });

    it("should reject Requester with 403 Forbidden", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/assign`)
        .set("Cookie", requesterSessionCookie)
        .send({ assigneeId: itStaffId });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/staff/tickets/:id/priority", () => {
    it("should update IT priority", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/priority`)
        .set("Cookie", itStaffSessionCookie)
        .send({ itPriority: "CRITICAL" });
      expect(res.status).toBe(200);
      expect(res.body.ticket.itPriority).toBe("CRITICAL");
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/priority`)
        .send({ itPriority: "CRITICAL" });
      expect(res.status).toBe(401);
    });

    it("should reject Requester with 403 Forbidden", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/priority`)
        .set("Cookie", requesterSessionCookie)
        .send({ itPriority: "CRITICAL" });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/staff/tickets/:id/status", () => {
    it("should allow valid transition NEW -> OPEN and log it", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", itStaffSessionCookie)
        .send({ status: "OPEN" });
      expect(res.status).toBe(200);
      expect(res.body.ticket.currentStatus).toBe("OPEN");

      const notes = await prisma.internalNote.findMany({ where: { ticketId: testTicketId } });
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe("Status changed from NEW to OPEN");
      expect(notes[0].authorId).toBe(itStaffId);
    });

    it("should reject invalid transition NEW -> CLOSED", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", itStaffSessionCookie)
        .send({ status: "CLOSED" });
      expect(res.status).toBe(400);
    });

    it("should require rejection reason for REJECTED transition and log it accurately", async () => {
      // Missing reason
      let res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", itStaffSessionCookie)
        .send({ status: "REJECTED" });
      expect(res.status).toBe(400);
      
      // With reason
      res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", itStaffSessionCookie)
        .send({ status: "REJECTED", rejectionReason: "Not a real issue" });
      expect(res.status).toBe(200);
      expect(res.body.ticket.currentStatus).toBe("REJECTED");

      // Verify internal note was created accurately
      const notes = await prisma.internalNote.findMany({ where: { ticketId: testTicketId } });
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe("Status changed from NEW to REJECTED. Reason: Not a real issue");
      expect(notes[0].authorId).toBe(itStaffId);
    });

    it("should allow valid transition OPEN -> RESOLVED and log it with actor ID and timestamp", async () => {
      await prisma.ticket.update({ where: { id: testTicketId }, data: { currentStatus: "OPEN" } });
      
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", itStaffSessionCookie)
        .send({ status: "RESOLVED" });
      expect(res.status).toBe(200);
      expect(res.body.ticket.currentStatus).toBe("RESOLVED");

      const notes = await prisma.internalNote.findMany({ where: { ticketId: testTicketId } });
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe("Status changed from OPEN to RESOLVED");
      expect(notes[0].authorId).toBe(itStaffId);
      expect(notes[0].createdAt).toBeDefined();
    });
    
    it("should enforce terminal states cannot transition", async () => {
      await prisma.ticket.update({ where: { id: testTicketId }, data: { currentStatus: "CLOSED" } });
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", itStaffSessionCookie)
        .send({ status: "OPEN" });
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .send({ status: "OPEN" });
      expect(res.status).toBe(401);
    });

    it("should reject Requester with 403 Forbidden", async () => {
      const res = await request(app).patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", requesterSessionCookie)
        .send({ status: "OPEN" });
      expect(res.status).toBe(403);
    });
  });
});
