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
    "iso-deactivate@example.com"
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
    // Isolated data fixture: Create a fresh admin user specifically for this test
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const tempAdmin = await prisma.user.create({
      data: { email: "iso-role@example.com", fullName: "Iso Admin", role: "ADMIN", passwordHash, isActive: true }
    });

    // Isolate from shared DB state by mocking the transaction to simulate this being the last admin
    const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        user: {
          findUnique: (args: any) => prisma.user.findUnique(args),
          update: (args: any) => prisma.user.update(args),
          count: vi.fn().mockResolvedValue(1)
        }
      });
    });

    const res = await request(app).put(`/api/admin/users/${tempAdmin.id}`).set("Cookie", adminSessionCookie).send({
      role: "IT_STAFF"
    });
    
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("last active Admin");

    // Clean up
    txSpy.mockRestore();
    await prisma.user.delete({ where: { id: tempAdmin.id } });
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

  it("should prevent deactivating the last active Admin", async () => {
    // Isolated data fixture: Create a fresh admin user specifically for this test
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const tempAdmin = await prisma.user.create({
      data: { email: "iso-deactivate@example.com", fullName: "Iso Admin", role: "ADMIN", passwordHash, isActive: true }
    });

    // To hit the "last active Admin" logic for deactivation (instead of "own account"),
    // we use adminSessionCookie (adminUserId) to deactivate tempAdmin,
    // and mock the transaction count to 1 to simulate tempAdmin being the last admin.
    const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        user: {
          findUnique: (args: any) => prisma.user.findUnique(args),
          update: (args: any) => prisma.user.update(args),
          count: vi.fn().mockResolvedValue(1)
        }
      });
    });

    const res = await request(app).put(`/api/admin/users/${tempAdmin.id}`).set("Cookie", adminSessionCookie).send({
      isActive: false
    });
    
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("last active Admin");

    // Clean up
    txSpy.mockRestore();
    await prisma.user.delete({ where: { id: tempAdmin.id } });
  });
});
