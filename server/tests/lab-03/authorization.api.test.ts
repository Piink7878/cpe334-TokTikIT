import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Authorization API Tests (Lab 3)", () => {
  let itStaffSessionCookie: string;
  let requesterSessionCookie: string;
  let otherRequesterSessionCookie: string;
  
  let req1Id: string;
  let req2Id: string;
  
  let ticketReq1Id: number;
  let ticketReq2Id: number;

  beforeAll(async () => {
    const emails = ["auth-staff@example.com", "auth-req1@example.com", "auth-req2@example.com"];
    
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
      data: { email: "auth-staff@example.com", fullName: "IT Staff", role: "IT_STAFF", passwordHash, isActive: true }
    });
    
    const req1 = await prisma.user.create({
      data: { email: "auth-req1@example.com", fullName: "Requester 1", role: "REQUESTER", passwordHash, isActive: true }
    });
    req1Id = req1.id;

    const req2 = await prisma.user.create({
      data: { email: "auth-req2@example.com", fullName: "Requester 2", role: "REQUESTER", passwordHash, isActive: true }
    });
    req2Id = req2.id;

    // Login
    const loginStaff = await request(app).post("/api/auth/login").send({ email: "auth-staff@example.com", password: "Password123!" });
    itStaffSessionCookie = loginStaff.headers["set-cookie"][0];

    const loginReq1 = await request(app).post("/api/auth/login").send({ email: "auth-req1@example.com", password: "Password123!" });
    requesterSessionCookie = loginReq1.headers["set-cookie"][0];

    const loginReq2 = await request(app).post("/api/auth/login").send({ email: "auth-req2@example.com", password: "Password123!" });
    otherRequesterSessionCookie = loginReq2.headers["set-cookie"][0];
  });

  beforeEach(async () => {
    if (ticketReq1Id) {
      await prisma.attachment.deleteMany({ where: { ticketId: { in: [ticketReq1Id, ticketReq2Id] } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: [ticketReq1Id, ticketReq2Id] } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: [ticketReq1Id, ticketReq2Id] } } });
      await prisma.ticket.deleteMany({ where: { id: { in: [ticketReq1Id, ticketReq2Id] } } });
    }
    
    const cat = await prisma.category.findFirst();
    const sys = await prisma.relatedSystem.findFirst();
    
    const t1 = await prisma.ticket.create({
      data: {
        ticketNumber: "AUTH-TKT-1",
        summary: "Ticket 1",
        categoryId: cat!.id,
        relatedSystemId: sys!.id,
        requesterId: req1Id,
        currentStatus: "NEW",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        description: "Test description"
      }
    });
    ticketReq1Id = t1.id;

    const t2 = await prisma.ticket.create({
      data: {
        ticketNumber: "AUTH-TKT-2",
        summary: "Ticket 2",
        categoryId: cat!.id,
        relatedSystemId: sys!.id,
        requesterId: req2Id,
        currentStatus: "NEW",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        description: "Test description"
      }
    });
    ticketReq2Id = t2.id;
  });

  afterAll(async () => {
    const emails = ["auth-staff@example.com", "auth-req1@example.com", "auth-req2@example.com"];
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

  it("should return 403 Forbidden when Requester tries to fetch internal notes", async () => {
    const res = await request(app).get(`/api/tickets/${ticketReq1Id}/internal-notes`).set("Cookie", requesterSessionCookie);
    expect(res.status).toBe(403);
  });

  it("should return 403 Forbidden when Requester tries to create internal notes", async () => {
    const res = await request(app).post(`/api/tickets/${ticketReq1Id}/internal-notes`).set("Cookie", requesterSessionCookie).send({ content: "test" });
    expect(res.status).toBe(403);
  });

  it("should reject Requester 1 from fetching public comments of Requester 2's ticket", async () => {
    const res = await request(app).get(`/api/tickets/${ticketReq2Id}/comments`).set("Cookie", requesterSessionCookie);
    expect(res.status).toBe(404);
  });

  it("should reject Requester 1 from posting public comments to Requester 2's ticket", async () => {
    const res = await request(app).post(`/api/tickets/${ticketReq2Id}/comments`).set("Cookie", requesterSessionCookie).send({ content: "test" });
    expect(res.status).toBe(404);
  });

  // API-03: Ignore client-supplied requesterId and enforce authenticated session ownership
  it("should ignore client-supplied requesterId on ticket creation and enforce session user", async () => {
    const cat = await prisma.category.findFirst();
    const sys = await prisma.relatedSystem.findFirst();
    const res = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterSessionCookie)
      .field("categoryId", cat!.id)
      .field("relatedSystemId", sys!.id)
      .field("requestedPriority", "HIGH")
      .field("summary", "Impersonation Attempt Ticket")
      .field("description", "Trying to create ticket on behalf of req2")
      .field("requesterId", req2Id); // Client supplies another user's ID

    expect(res.status).toBe(201);
    expect(res.body.data.requesterId).toBe(req1Id);
    expect(res.body.data.requesterId).not.toBe(req2Id);

    // Clean up created ticket
    await prisma.ticket.delete({ where: { id: res.body.data.id } });
  });

  // API-07: Requester cannot modify it_priority
  it("should reject Requester from modifying IT Priority with 403 Forbidden", async () => {
    const res = await request(app)
      .patch(`/api/staff/tickets/${ticketReq1Id}/priority`)
      .set("Cookie", requesterSessionCookie)
      .send({ itPriority: "CRITICAL" });
    expect(res.status).toBe(403);
  });

  // API-12: Requester views only their own tickets
  it("should ensure Requester only retrieves their own tickets from GET /api/tickets", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("Cookie", requesterSessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some((t: any) => t.id === ticketReq1Id)).toBe(true);
    expect(res.body.data.some((t: any) => t.id === ticketReq2Id)).toBe(false);
  });

  // API-15: Requester attempting Admin operations returns 403 Forbidden
  it("should return 403 Forbidden when Requester attempts Admin operations", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", requesterSessionCookie);
    expect(res.status).toBe(403);
  });

  // API-13: Unauthenticated access to protected endpoints returns 401 Unauthorized
  describe("Unauthenticated Access Restrictions (401 Unauthorized)", () => {
    it("should return 401 for GET /api/tickets without auth", async () => {
      const res = await request(app).get("/api/tickets");
      expect(res.status).toBe(401);
    });

    it("should return 401 for POST /api/tickets without auth", async () => {
      const res = await request(app)
        .post("/api/tickets")
        .field("summary", "No auth ticket");
      expect(res.status).toBe(401);
    });

    it("should return 401 for GET /api/tickets/:id without auth", async () => {
      const res = await request(app).get(`/api/tickets/${ticketReq1Id}`);
      expect(res.status).toBe(401);
    });

    it("should return 401 for GET /api/attachments/:id/download without auth", async () => {
      const res = await request(app).get("/api/attachments/99999/download");
      expect(res.status).toBe(401);
    });

    it("should return 401 for DELETE /api/attachments/:id without auth", async () => {
      const res = await request(app)
        .delete("/api/attachments/99999")
        .send({ removalReason: "Valid removal reason text" });
      expect(res.status).toBe(401);
    });
  });

  // Ticket and Attachment ownership checks (Forbidden or Not Found)
  describe("Ticket and Attachment Ownership Enforcement", () => {
    it("should return 403 Forbidden when Requester 1 tries to view Requester 2's ticket", async () => {
      const res = await request(app)
        .get(`/api/tickets/${ticketReq2Id}`)
        .set("Cookie", requesterSessionCookie);
      expect(res.status).toBe(403);
    });

    it("should return 403 Forbidden when Requester 1 tries to download Requester 2's attachment", async () => {
      const att = await prisma.attachment.create({
        data: {
          ticketId: ticketReq2Id,
          originalName: "secret.pdf",
          storedName: "stored-secret.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          isRemoved: false
        }
      });

      try {
        const res = await request(app)
          .get(`/api/attachments/${att.id}/download`)
          .set("Cookie", requesterSessionCookie);
        expect(res.status).toBe(403);
      } finally {
        await prisma.attachment.delete({ where: { id: att.id } });
      }
    });

    it("should return 403 Forbidden when Requester 1 tries to delete Requester 2's attachment", async () => {
      const att = await prisma.attachment.create({
        data: {
          ticketId: ticketReq2Id,
          originalName: "secret.pdf",
          storedName: "stored-secret.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          isRemoved: false
        }
      });

      try {
        const res = await request(app)
          .delete(`/api/attachments/${att.id}`)
          .set("Cookie", requesterSessionCookie)
          .send({ removalReason: "Attempt to delete other's attachment" });
        expect(res.status).toBe(403);
      } finally {
        await prisma.attachment.delete({ where: { id: att.id } });
      }
    });
  });
});
