import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import bcrypt from "bcryptjs";

async function clearDatabase(prisma: any) {
  // Only delete tickets and users created for THIS test suite to avoid breaking other parallel tests
  await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: 'TKT-2026-000' } }
  });
  await prisma.user.deleteMany({
    where: { email: { in: ["staff_test@example.com", "admin_test@example.com", "requester_test@example.com"] } }
  });
}

describe("IT Staff Ticket Queue API", () => {
  let staffCookie: string;
  let adminCookie: string;
  let requesterCookie: string;
  let staffUser: any;
  let requesterUser: any;
  let category: any;
  let relatedSystem: any;
  let ticket1: any;
  let ticket2: any;

  beforeAll(async () => {
    const prisma = getPrisma();

    const passwordHash = await bcrypt.hash("Password123!", 10);

    const suffix = Date.now().toString().slice(-6);

    staffUser = await prisma.user.create({
      data: {
        email: `staff_${suffix}@example.com`,
        fullName: "IT Staff",
        passwordHash,
        role: "IT_STAFF"
      }
    });

    const adminUser = await prisma.user.create({
      data: {
        email: `admin_${suffix}@example.com`,
        fullName: "Admin User",
        passwordHash,
        role: "ADMIN"
      }
    });

    requesterUser = await prisma.user.create({
      data: {
        email: `requester_${suffix}@example.com`,
        fullName: "Requester User",
        passwordHash,
        role: "REQUESTER"
      }
    });

    category = await prisma.category.create({
      data: { name: `Network_${suffix}` }
    });
    relatedSystem = await prisma.relatedSystem.create({
      data: { name: `VPN_${suffix}` }
    });

    // Create tickets
    ticket1 = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-99${suffix}1`,
        summary: `VPN is slow ${suffix}`,
        description: "Cannot connect well",
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requesterId: requesterUser.id,
        currentStatus: "NEW",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        createdAt: new Date("2026-01-01T10:00:00Z")
      }
    });

    ticket2 = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-99${suffix}2`,
        summary: `Printer not working ${suffix}`,
        description: "Printer offline",
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requesterId: requesterUser.id,
        ownerId: staffUser.id,
        currentStatus: "IN_PROGRESS",
        requestedPriority: "LOW",
        itPriority: "LOW",
        createdAt: new Date("2026-01-02T10:00:00Z")
      }
    });

    // Login users to get cookies
    let res = await request(app).post("/api/auth/login").send({ email: `staff_${suffix}@example.com`, password: "Password123!" });
    staffCookie = res.headers["set-cookie"][0];

    res = await request(app).post("/api/auth/login").send({ email: `admin_${suffix}@example.com`, password: "Password123!" });
    adminCookie = res.headers["set-cookie"][0];

    res = await request(app).post("/api/auth/login").send({ email: `requester_${suffix}@example.com`, password: "Password123!" });
    requesterCookie = res.headers["set-cookie"][0];
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({ where: { id: { in: [ticket1.id, ticket2.id] } } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.relatedSystem.deleteMany({ where: { id: relatedSystem.id } });
    await prisma.user.deleteMany({ where: { email: { contains: "example.com" }, role: { in: ["IT_STAFF", "ADMIN", "REQUESTER"] } } });
  });

  it("should deny access to unauthenticated requests", async () => {
    const res = await request(app).get("/api/staff/tickets");
    expect(res.status).toBe(401);
  });

  it("should deny access to a requester", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}`)
      .set("Cookie", requesterCookie);
    expect(res.status).toBe(403);
  });

  it("should allow IT Staff to retrieve the queue", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.data[0]).toHaveProperty("requester");
    expect(res.body.data[0].requester.name).toBe("Requester User");
  });

  it("should allow Admin to retrieve the queue", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it("should apply search filter", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&search=printer`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].ticketNumber).toBe(ticket2.ticketNumber);
  });

  it("should apply ownerId=unassigned filter", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&ownerId=unassigned`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].ticketNumber).toBe(ticket1.ticketNumber);
  });

  it("should apply status filter", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&status=IN_PROGRESS`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe("IN_PROGRESS");
  });

  it("should apply itPriority filter", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&itPriority=LOW`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].itPriority).toBe("LOW");
  });

  it("should apply specific ownerId filter", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&ownerId=${staffUser.id}`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].owner.id).toBe(staffUser.id);
  });

  it("should fallback safely for invalid pagination parameters", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&page=-5&limit=invalid`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1); // Default fallback
    expect(res.body.pagination.limit).toBe(10); // Default fallback
  });

  it("should handle pagination", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&page=1&limit=1`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.totalItems).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it("should apply sort order ascending", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&sortBy=createdAt&sortOrder=asc`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].ticketNumber).toBe(ticket1.ticketNumber);
    expect(res.body.data[1].ticketNumber).toBe(ticket2.ticketNumber);
  });

  it("should apply sort order descending", async () => {
    const res = await request(app)
      .get(`/api/staff/tickets?categoryId=${category.id}&sortBy=createdAt&sortOrder=desc`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].ticketNumber).toBe(ticket2.ticketNumber);
    expect(res.body.data[1].ticketNumber).toBe(ticket1.ticketNumber);
  });
});
