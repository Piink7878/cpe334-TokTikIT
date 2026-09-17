import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Admin User Management API", () => {
  let adminSessionCookie: string;
  let staffSessionCookie: string;
  let adminId: string;
  let targetUserId: string;

  beforeAll(async () => {
    const emails = ["admin-mng-admin@example.com", "admin-mng-staff@example.com", "admin-mng-target@example.com"];
    
    // Clean up
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    const pwdHash = await bcrypt.hash("Password123!", 12);

    // Create Admin
    const adminUser = await prisma.user.create({
      data: {
        email: "admin-mng-admin@example.com",
        fullName: "Test Admin",
        role: "ADMIN",
        passwordHash: pwdHash,
        isActive: true,
        mustChangePassword: false
      }
    });
    adminId = adminUser.id;

    // Create Staff
    await prisma.user.create({
      data: {
        email: "admin-mng-staff@example.com",
        fullName: "Test Staff",
        role: "IT_STAFF",
        passwordHash: pwdHash,
        isActive: true,
        mustChangePassword: false
      }
    });

    // Create Target User
    const targetUser = await prisma.user.create({
      data: {
        email: "admin-mng-target@example.com",
        fullName: "Test Target",
        role: "REQUESTER",
        passwordHash: pwdHash,
        isActive: true,
        mustChangePassword: false
      }
    });
    targetUserId = targetUser.id;

    // Login Admin
    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin-mng-admin@example.com",
      password: "Password123!"
    });
    
    if (adminLogin.status !== 200) {
      console.error("Admin login failed:", adminLogin.body);
    }
    
    adminSessionCookie = adminLogin.headers["set-cookie"]?.[0] || "";

    // Login Staff
    const staffLogin = await request(app).post("/api/auth/login").send({
      email: "admin-mng-staff@example.com",
      password: "Password123!"
    });
    staffSessionCookie = staffLogin.headers["set-cookie"][0];
  });

  afterAll(async () => {
    const emails = ["admin-mng-admin@example.com", "admin-mng-staff@example.com", "admin-mng-target@example.com"];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    // Also delete any users created during tests
    await prisma.user.deleteMany({ where: { email: { startsWith: "admin-mng-created-" } } });
  });

  describe("GET /api/admin/users", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const res = await request(app)
        .get("/api/admin/users");
      expect(res.status).toBe(401);
    });

    it("should return 403 for IT_STAFF", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Cookie", staffSessionCookie);
      expect(res.status).toBe(403);
    });

    it("should return users for ADMIN", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Cookie", adminSessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it("should allow searching users", async () => {
      const res = await request(app)
        .get("/api/admin/users?search=admin-mng-target")
        .set("Cookie", adminSessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].email).toBe("admin-mng-target@example.com");
    });
  });

  describe("POST /api/admin/users", () => {
    it("should return 403 for IT_STAFF", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Cookie", staffSessionCookie)
        .send({ fullName: "Nope", email: "admin-mng-created-1@example.com", role: "REQUESTER" });
      expect(res.status).toBe(403);
    });

    it("should create a new user for ADMIN", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Cookie", adminSessionCookie)
        .send({ fullName: "Created User", email: "admin-mng-created-2@example.com", role: "REQUESTER" });
      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("admin-mng-created-2@example.com");
      expect(res.body.user.mustChangePassword).toBe(true);
      expect(res.body.tempPassword).toBeDefined();
    });
    
    it("should fail if email is duplicate", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Cookie", adminSessionCookie)
        .send({ fullName: "Dup User", email: "admin-mng-admin@example.com", role: "REQUESTER" });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("in use");
    });
  });

  describe("PATCH /api/admin/users/:id", () => {
    it("should update user details", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUserId}`)
        .set("Cookie", adminSessionCookie)
        .send({ fullName: "Updated Target", role: "IT_STAFF" });
      expect(res.status).toBe(200);
      expect(res.body.user.fullName).toBe("Updated Target");
      expect(res.body.user.role).toBe("IT_STAFF");
    });

    it("should prevent self demotion", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminId}`)
        .set("Cookie", adminSessionCookie)
        .send({ role: "REQUESTER" });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("cannot demote yourself");
    });

    it("should prevent self deactivation", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminId}`)
        .set("Cookie", adminSessionCookie)
        .send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("cannot deactivate your own account");
    });
  });

  describe("POST /api/admin/users/:id/reset-password", () => {
    it("should reset password and generate a temporary one", async () => {
      const res = await request(app)
        .post(`/api/admin/users/${targetUserId}/reset-password`)
        .set("Cookie", adminSessionCookie);
      expect(res.status).toBe(200);
      expect(res.body.tempPassword).toBeDefined();
    });

    it("should set mustChangePassword to true", async () => {
      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      expect(user?.mustChangePassword).toBe(true);
    });
  });
});
