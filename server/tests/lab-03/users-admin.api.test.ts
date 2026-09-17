import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Admin User Management API Tests (Lab 3)", () => {
  let adminSessionCookie: string;
  let requesterSessionCookie: string;
  let itStaffSessionCookie: string;
  let adminUserId: string;

  const testEmails = [
    "admin-test1@example.com", 
    "admin-req@example.com", 
    "admin-staff@example.com", 
    "newuser@example.com", 
    "dup@example.com",
    "iso-role@example.com",
    "updateme@example.com",
    "iso-deactivate@example.com",
    "adminA@example.com",
    "adminB@example.com"
  ];

  beforeAll(async () => {
    // Clean up
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const admin = await prisma.user.create({
      data: { email: "admin-test1@example.com", fullName: "Admin User", role: "ADMIN", passwordHash, isActive: true }
    });
    adminUserId = admin.id;

    await prisma.user.create({
      data: { email: "admin-req@example.com", fullName: "Req User", role: "REQUESTER", passwordHash, isActive: true }
    });
    await prisma.user.create({
      data: { email: "admin-staff@example.com", fullName: "Staff User", role: "IT_STAFF", passwordHash, isActive: true }
    });

    const loginAdmin = await request(app).post("/api/auth/login").send({ email: "admin-test1@example.com", password: "Password123!" });
    adminSessionCookie = loginAdmin.headers["set-cookie"][0];

    const loginReq = await request(app).post("/api/auth/login").send({ email: "admin-req@example.com", password: "Password123!" });
    requesterSessionCookie = loginReq.headers["set-cookie"][0];
    
    const loginStaff = await request(app).post("/api/auth/login").send({ email: "admin-staff@example.com", password: "Password123!" });
    itStaffSessionCookie = loginStaff.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  });

  it("should return 403 Forbidden when Requester tries to access /api/admin/users", async () => {
    const res = await request(app).get("/api/admin/users").set("Cookie", requesterSessionCookie);
    expect(res.status).toBe(403);
  });

  it("should return 403 Forbidden when IT Staff tries to access /api/admin/users", async () => {
    const res = await request(app).get("/api/admin/users").set("Cookie", itStaffSessionCookie);
    expect(res.status).toBe(403);
  });

  it("should create a user successfully and prevent duplicate emails", async () => {
    const createRes = await request(app).post("/api/admin/users").set("Cookie", adminSessionCookie).send({
      name: "New User",
      email: "newuser@example.com",
      role: "REQUESTER",
      password: "Password123!"
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.requiresPasswordChange).toBe(true);

    const dupRes = await request(app).post("/api/admin/users").set("Cookie", adminSessionCookie).send({
      name: "Duplicate User",
      email: "newuser@example.com",
      role: "REQUESTER",
      password: "Password123!"
    });
    expect(dupRes.status).toBe(409);
  });

  it("should prevent an Admin from deactivating their own account", async () => {
    const res = await request(app).put(`/api/admin/users/${adminUserId}`).set("Cookie", adminSessionCookie).send({
      isActive: false
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("deactivate your own account");
  });

  it("should prevent changing the role of the last active Admin", async () => {
    // Temporarily deactivate other admins to ensure this is the last one
    const otherAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, id: { not: adminUserId } }
    });
    if (otherAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherAdmins.map(a => a.id) } },
        data: { isActive: false }
      });
    }

    const res = await request(app).put(`/api/admin/users/${adminUserId}`).set("Cookie", adminSessionCookie).send({
      role: "IT_STAFF"
    });
    
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("last active Admin");

    // Restore
    if (otherAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherAdmins.map(a => a.id) } },
        data: { isActive: true }
      });
    }
  });

  it("should return 400 when updating user with invalid role", async () => {
    const res = await request(app).put(`/api/admin/users/${adminUserId}`).set("Cookie", adminSessionCookie).send({
      role: "INVALID_ROLE"
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Invalid role");
  });

  it("should update a user successfully", async () => {
    // Create a temp user to update
    const temp = await request(app).post("/api/admin/users").set("Cookie", adminSessionCookie).send({
      name: "Update Me",
      email: "updateme@example.com",
      role: "REQUESTER",
      password: "Password123!"
    });
    const tempId = temp.body.id;

    const res = await request(app).put(`/api/admin/users/${tempId}`).set("Cookie", adminSessionCookie).send({
      name: "Updated Name",
      role: "IT_STAFF",
      isActive: false
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.role).toBe("IT_STAFF");
    expect(res.body.isActive).toBe(false);
  });

  it("should reset password successfully", async () => {
    // We already have "admin-req@example.com"
    const user = await prisma.user.findUnique({ where: { email: "admin-req@example.com" } });
    
    const res = await request(app).post(`/api/admin/users/${user!.id}/reset-password`).set("Cookie", adminSessionCookie).send({
      newPassword: "NewPassword123!"
    });
    expect(res.status).toBe(200);
    
    const updated = await prisma.user.findUnique({ where: { email: "admin-req@example.com" } });
    expect(updated!.mustChangePassword).toBe(true);
  });

  it("should list users and support search/filter", async () => {
    const listRes = await request(app).get("/api/admin/users").set("Cookie", adminSessionCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const searchRes = await request(app).get("/api/admin/users?search=Staff User").set("Cookie", adminSessionCookie);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data[0].email).toBe("admin-staff@example.com");

    const filterRes = await request(app).get("/api/admin/users?role=IT_STAFF").set("Cookie", adminSessionCookie);
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.data.every((u: any) => u.role === "IT_STAFF")).toBe(true);
  });

  it("should prevent deactivating the last active Admin under concurrent load", async () => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Two admins: A (target) and C (caller). Start with exactly 2 active admins.
    // C concurrently fires two requests to deactivate A.
    // First request succeeds (200) — 1 admin (C) remains.
    // Second request's Serializable transaction sees the conflict → P2034 → 409.
    // No 401 risk: C's session is never deactivated.

    // Pre-cleanup in case a previous test run failed and left fixture data behind
    await prisma.user.deleteMany({
      where: { email: { in: ["adminA@example.com", "adminC@example.com"] } }
    });

    const adminA = await prisma.user.create({
      data: { email: "adminA@example.com", fullName: "Admin A", role: "ADMIN", passwordHash, isActive: true }
    });
    const adminC = await prisma.user.create({
      data: { email: "adminC@example.com", fullName: "Admin C", role: "ADMIN", passwordHash, isActive: true }
    });

    // Fetch and store original states of all other admins
    const otherAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", id: { notIn: [adminA.id, adminC.id] } },
      select: { id: true, isActive: true }
    });

    // Deactivate all other admins so exactly A and C are active
    await prisma.user.updateMany({
      where: { role: "ADMIN", id: { notIn: [adminA.id, adminC.id] } },
      data: { isActive: false }
    });

    let server: any;
    try {
      // C logs in — C is never the deactivation target, so no 401 risk
      const loginC = await request(app).post("/api/auth/login").send({ email: "adminC@example.com", password: "Password123!" });
      const cookieC = loginC.headers["set-cookie"]?.[0] || "";

      // Real TCP server: both requests arrive on separate connections,
      // ensuring requireAuth runs for both before either Serializable transaction commits.
      server = await new Promise<any>((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      const port = (server.address() as any).port;
      const base = `http://localhost:${port}`;

      // Set a delay inside the controller's Serializable transaction so both
      // requests acquire their FOR UPDATE lock at the same time, causing a genuine
      // P2034 serialization failure on one of them.
      process.env.TEST_CONCURRENCY_DELAY_MS = "200";

      // C fires two concurrent requests to deactivate A.
      // One wins the Serializable lock; the other gets P2034 → 409.
      const [res1, res2] = await Promise.all([
        fetch(`${base}/api/admin/users/${adminA.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: cookieC },
          body: JSON.stringify({ isActive: false })
        }),
        fetch(`${base}/api/admin/users/${adminA.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: cookieC },
          body: JSON.stringify({ isActive: false })
        })
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);

      // Exactly one succeeds (200), exactly one gets a Serializable conflict (409).
      expect(statuses).toEqual([200, 409]);

      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
      expect(activeAdmins).toBe(1);
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      delete process.env.TEST_CONCURRENCY_DELAY_MS;

      // Delete the specific test fixtures
      await prisma.user.deleteMany({
        where: { id: { in: [adminA.id, adminC.id] } }
      });

      // Restore the original isActive states of all other Admins
      for (const admin of otherAdmins) {
        await prisma.user.update({
          where: { id: admin.id },
          data: { isActive: admin.isActive }
        });
      }
    }
  });
});
