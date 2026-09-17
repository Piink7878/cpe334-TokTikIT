import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Admin User Management API Tests (Lab 3)", () => {
  let adminSessionCookie: string;
  let requesterSessionCookie: string;
  let itStaffSessionCookie: string;
  let adminUserId: string;

  beforeAll(async () => {
    const emails = ["admin-test1@example.com", "admin-req@example.com", "admin-staff@example.com", "newuser@example.com", "dup@example.com"];
    
    // Clean up
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

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
    const emails = ["admin-test1@example.com", "admin-req@example.com", "admin-staff@example.com", "newuser@example.com", "dup@example.com"];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
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
});
