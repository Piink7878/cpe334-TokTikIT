import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Comments and Internal Notes API", () => {
  let adminCookie: string;
  let staffCookie: string;
  let req1Cookie: string;
  let req2Cookie: string;

  let req1TicketId: number;
  let adminId: string;
  let staffId: string;
  let req1Id: string;
  let req2Id: string;
  let catId: number;
  let sysId: number;

  beforeAll(async () => {
    // Setup test users
    const passwordHash = await bcrypt.hash("Password123!", 12);
    const admin = await prisma.user.create({ data: { email: "admin-comments@test.com", fullName: "Admin", role: "ADMIN", passwordHash, mustChangePassword: false, isActive: true } });
    const staff = await prisma.user.create({ data: { email: "staff-comments@test.com", fullName: "Staff", role: "IT_STAFF", passwordHash, mustChangePassword: false, isActive: true } });
    const req1 = await prisma.user.create({ data: { email: "req1-comments@test.com", fullName: "Req 1", role: "REQUESTER", passwordHash, mustChangePassword: false, isActive: true } });
    const req2 = await prisma.user.create({ data: { email: "req2-comments@test.com", fullName: "Req 2", role: "REQUESTER", passwordHash, mustChangePassword: false, isActive: true } });

    adminId = admin.id;
    staffId = staff.id;
    req1Id = req1.id;
    req2Id = req2.id;

    // Login users
    let res = await request(app).post("/api/auth/login").send({ email: "admin-comments@test.com", password: "Password123!" });
    adminCookie = res.headers["set-cookie"]?.[0] || "";

    res = await request(app).post("/api/auth/login").send({ email: "staff-comments@test.com", password: "Password123!" });
    staffCookie = res.headers["set-cookie"]?.[0] || "";

    res = await request(app).post("/api/auth/login").send({ email: "req1-comments@test.com", password: "Password123!" });
    req1Cookie = res.headers["set-cookie"]?.[0] || "";

    res = await request(app).post("/api/auth/login").send({ email: "req2-comments@test.com", password: "Password123!" });
    req2Cookie = res.headers["set-cookie"]?.[0] || "";

    // Create Category and System
    const cat = await prisma.category.create({ data: { name: "Test Cat Comments" } });
    catId = cat.id;
    const sys = await prisma.relatedSystem.create({ data: { name: "Test Sys Comments" } });
    sysId = sys.id;

    // Create a ticket owned by req1
    const tkt = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-999001",
        summary: "Req1 Ticket",
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
    await prisma.publicComment.deleteMany({ where: { ticketId: req1TicketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId: req1TicketId } });
    await prisma.attachment.deleteMany({ where: { ticketId: req1TicketId } });
    await prisma.ticket.deleteMany({ where: { id: req1TicketId } });
    await prisma.category.deleteMany({ where: { id: catId } });
    await prisma.relatedSystem.deleteMany({ where: { id: sysId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, staffId, req1Id, req2Id] } } });
  });

  it("should allow Requester to post a public comment on their ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/comments`)
      .set("Cookie", req1Cookie)
      .send({ content: "This is a public comment from req1" });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("This is a public comment from req1");
    expect(res.body.data.authorId).toBe(req1Id);
  });

  it("should return 400 Bad Request if comment payload is empty", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/comments`)
      .set("Cookie", req1Cookie)
      .send({ content: "   " });

    expect(res.status).toBe(400);
  });

  it("should return 403 Forbidden if Requester posts comment on another's ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/comments`)
      .set("Cookie", req2Cookie)
      .send({ content: "Trying to comment" });

    expect(res.status).toBe(403);
  });

  it("should allow IT Staff to post a public comment on any ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/comments`)
      .set("Cookie", staffCookie)
      .send({ content: "IT Staff public comment" });

    expect(res.status).toBe(201);
  });

  it("should allow IT Staff to post an internal note", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/internal-notes`)
      .set("Cookie", staffCookie)
      .send({ content: "Staff internal note" });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("Staff internal note");
  });

  it("should allow Admin to post an internal note", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/internal-notes`)
      .set("Cookie", adminCookie)
      .send({ content: "Admin internal note" });

    expect(res.status).toBe(201);
  });

  it("should allow IT Staff to retrieve internal notes", async () => {
    const res = await request(app)
      .get(`/api/tickets/${req1TicketId}/internal-notes`)
      .set("Cookie", staffCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // The two we just added
  });

  it("should return 403 Forbidden when Requester tries to get internal notes", async () => {
    const res = await request(app)
      .get(`/api/tickets/${req1TicketId}/internal-notes`)
      .set("Cookie", req1Cookie);

    expect(res.status).toBe(403);
  });

  it("should NOT expose internal notes when Requester calls GET /api/tickets/:id", async () => {
    const res = await request(app)
      .get(`/api/tickets/${req1TicketId}`)
      .set("Cookie", req1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.publicComments).toBeDefined(); // publicComments should be visible
    expect(res.body.data.publicComments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.internalNotes).toBeUndefined(); // Zero Information Leakage
  });

  it("should return 403 Forbidden if Requester indicates resolved on another's ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/indicate-resolved`)
      .set("Cookie", req2Cookie);
    expect(res.status).toBe(403);
  });

  it("should allow Requester to indicate problem appears resolved without changing status", async () => {
    // Current status is OPEN
    const res = await request(app)
      .post(`/api/tickets/${req1TicketId}/indicate-resolved`)
      .set("Cookie", req1Cookie);

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("Requester indicated that the problem appears resolved.");

    // Check status remains strictly OPEN (unchanged)
    const ticketRes = await request(app)
      .get(`/api/tickets/${req1TicketId}`)
      .set("Cookie", req1Cookie);
    
    expect(ticketRes.body.data.status).toBe("OPEN");
    expect(ticketRes.body.data.status).not.toBe("RESOLVED");

    // Fetch comments to ensure the message was appended and is visible
    const commentsRes = await request(app)
      .get(`/api/tickets/${req1TicketId}/comments`)
      .set("Cookie", req1Cookie);
    expect(commentsRes.status).toBe(200);
    const comments = commentsRes.body.data;
    const resolvedComment = comments.find((c: any) => c.body === "Requester indicated that the problem appears resolved.");
    expect(resolvedComment).toBeDefined();
  });

  it("should enforce append-only guarantee for comments and notes (no PUT, PATCH, DELETE)", async () => {
    // Verify no endpoints exist to modify or delete comments
    let res = await request(app).put(`/api/tickets/${req1TicketId}/comments/1`).set("Cookie", staffCookie);
    expect([404, 405]).toContain(res.status);

    res = await request(app).patch(`/api/tickets/${req1TicketId}/comments/1`).set("Cookie", staffCookie);
    expect([404, 405]).toContain(res.status);

    res = await request(app).delete(`/api/tickets/${req1TicketId}/comments/1`).set("Cookie", staffCookie);
    expect([404, 405]).toContain(res.status);

    // Verify no endpoints exist to modify or delete internal notes
    res = await request(app).put(`/api/tickets/${req1TicketId}/internal-notes/1`).set("Cookie", staffCookie);
    expect([404, 405]).toContain(res.status);

    res = await request(app).delete(`/api/tickets/${req1TicketId}/internal-notes/1`).set("Cookie", staffCookie);
    expect([404, 405]).toContain(res.status);
  });

  it("should persist sequential comments in chronological order without overwriting", async () => {
    // Post multiple sequential comments
    await request(app).post(`/api/tickets/${req1TicketId}/comments`).set("Cookie", staffCookie).send({ content: "Append Test A" });
    await request(app).post(`/api/tickets/${req1TicketId}/comments`).set("Cookie", staffCookie).send({ content: "Append Test B" });
    await request(app).post(`/api/tickets/${req1TicketId}/comments`).set("Cookie", staffCookie).send({ content: "Append Test C" });

    // Fetch and verify all are intact and ordered chronologically
    const res = await request(app).get(`/api/tickets/${req1TicketId}/comments`).set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    
    const comments = res.body.data;
    const appendTests = comments.filter((c: any) => c.body.startsWith("Append Test"));
    
    expect(appendTests.length).toBe(3);
    expect(appendTests[0].body).toBe("Append Test A");
    expect(appendTests[1].body).toBe("Append Test B");
    expect(appendTests[2].body).toBe("Append Test C");

    // Check timestamps are strictly sequential
    const timeA = new Date(appendTests[0].createdAt).getTime();
    const timeB = new Date(appendTests[1].createdAt).getTime();
    const timeC = new Date(appendTests[2].createdAt).getTime();
    
    expect(timeA).toBeLessThanOrEqual(timeB);
    expect(timeB).toBeLessThanOrEqual(timeC);
  });

});
