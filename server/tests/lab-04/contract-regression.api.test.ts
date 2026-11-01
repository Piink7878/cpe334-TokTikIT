import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Contract Regression Suite (TC-REG-09, Lab 1-3 vs Lab 4)", () => {
  let staffCookie: string;
  let requesterCookie: string;
  let staffId: string;
  let requesterId: string;
  let categoryId: number;
  let systemId: number;
  let testTicketId: number;
  let actionTakenId: number;

  beforeAll(async () => {
    const emails = ["reg-staff@example.com", "reg-req@example.com"];

    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    if (users.length > 0) {
      const uIds = users.map((u) => u.id);
      const tickets = await prisma.ticket.findMany({
        where: { OR: [{ requesterId: { in: uIds } }, { ownerId: { in: uIds } }] },
      });
      const tIds = tickets.map((t) => t.id);

      await prisma.actionTakenRevision.deleteMany({ where: { actionTaken: { ticketId: { in: tIds } } } });
      await prisma.idempotencyRecord.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: tIds } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const staff = await prisma.user.create({
      data: { email: "reg-staff@example.com", fullName: "Regression Staff", role: "IT_STAFF", passwordHash, isActive: true },
    });
    staffId = staff.id;

    const requester = await prisma.user.create({
      data: { email: "reg-req@example.com", fullName: "Regression Requester", role: "REQUESTER", passwordHash, isActive: true },
    });
    requesterId = requester.id;

    const cat = await prisma.category.findFirst();
    categoryId = cat!.id;

    const sys = await prisma.relatedSystem.findFirst();
    systemId = sys!.id;

    const sLogin = await request(app).post("/api/auth/login").send({ email: "reg-staff@example.com", password: "Password123!" });
    staffCookie = sLogin.headers["set-cookie"][0];

    const rLogin = await request(app).post("/api/auth/login").send({ email: "reg-req@example.com", password: "Password123!" });
    requesterCookie = rLogin.headers["set-cookie"][0];

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-REG-${Date.now()}`,
        summary: "Regression test ticket",
        description: "Checking legacy and new API contracts",
        categoryId,
        relatedSystemId: systemId,
        requesterId,
        ownerId: staffId,
        currentStatus: "IN_PROGRESS",
        itPriority: "HIGH",
      },
    });
    testTicketId = ticket.id;

    const action = await prisma.actionTaken.create({
      data: {
        ticketId: testTicketId,
        performedById: staffId,
        description: "Initial regression action",
        result: "Success",
      },
    });
    actionTakenId = action.id;
  });

  afterAll(async () => {
    const emails = ["reg-staff@example.com", "reg-req@example.com"];
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    if (users.length > 0) {
      const uIds = users.map((u) => u.id);
      const tickets = await prisma.ticket.findMany({
        where: { OR: [{ requesterId: { in: uIds } }, { ownerId: { in: uIds } }] },
      });
      const tIds = tickets.map((t) => t.id);

      await prisma.actionTakenRevision.deleteMany({ where: { actionTaken: { ticketId: { in: tIds } } } });
      await prisma.idempotencyRecord.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: tIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: tIds } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
  });

  describe("Legacy Endpoints Contract Preservation (Lab 1 - Lab 3)", () => {
    it("POST /api/auth/login maintains { user } contract", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "reg-staff@example.com", password: "Password123!" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user).toHaveProperty("role");
      expect(res.body.user).toHaveProperty("fullName");
      // Legacy must NOT be wrapped in { data: ... }
      expect(res.body.data).toBeUndefined();
    });

    it("GET /api/auth/me maintains { user } contract", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", staffCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.data).toBeUndefined();
    });

    it("GET /api/tickets maintains { data, pagination } contract for requesters", async () => {
      const res = await request(app)
        .get("/api/tickets")
        .set("Cookie", requesterCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("GET /api/staff/tickets maintains { data, pagination } contract", async () => {
      const res = await request(app)
        .get("/api/staff/tickets")
        .set("Cookie", staffCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("GET /api/staff/tickets/:id maintains direct ticket object contract with Lab 3 relations", async () => {
      const res = await request(app)
        .get(`/api/staff/tickets/${testTicketId}`)
        .set("Cookie", staffCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("ticketNumber");
      expect(res.body).toHaveProperty("requester");
      expect(res.body).toHaveProperty("owner");
      expect(res.body).toHaveProperty("category");
      expect(res.body).toHaveProperty("relatedSystem");
      expect(res.body).toHaveProperty("internalNotes");
      expect(res.body).toHaveProperty("publicComments");
    });

    it("PATCH /api/staff/tickets/:id/status maintains { message, ticket } contract", async () => {
      const res = await request(app)
        .patch(`/api/staff/tickets/${testTicketId}/status`)
        .set("Cookie", staffCookie)
        .send({ status: "WAITING_FOR_REQUESTER" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("ticket");
      expect(res.body.ticket.currentStatus).toBe("WAITING_FOR_REQUESTER");
    });
  });

  describe("New Lab 4 Endpoints Contract Compliance ({ data: ... })", () => {
    it("POST /api/tickets/:id/actions-taken returns { message, data }", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/actions-taken`)
        .set("Cookie", staffCookie)
        .set("Idempotency-Key", `idem-reg-${Date.now()}`)
        .send({
          description: "New action verifying envelope",
          result: "Verified",
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("performedById");
    });

    it("PATCH /api/actions-taken/:actionId returns { message, data }", async () => {
      const action = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionTakenId } });

      const res = await request(app)
        .patch(`/api/actions-taken/${actionTakenId}`)
        .set("Cookie", staffCookie)
        .send({
          expectedUpdatedAt: action.updatedAt.toISOString(),
          description: "Updated description verifying envelope",
          result: "Updated result",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("data");
      expect(res.body.data.description).toBe("Updated description verifying envelope");
    });

    it("GET /api/tickets/:id/actions-taken returns { data: [...] }", async () => {
      const res = await request(app)
        .get(`/api/tickets/${testTicketId}/actions-taken`)
        .set("Cookie", staffCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("DELETE /api/actions-taken/:actionId returns 405 with { error: { code, message } }", async () => {
      const res = await request(app)
        .delete(`/api/actions-taken/${actionTakenId}`)
        .set("Cookie", staffCookie);

      expect(res.status).toBe(405);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toHaveProperty("code");
      expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
      expect(res.body.error).toHaveProperty("message");
    });
  });
});
