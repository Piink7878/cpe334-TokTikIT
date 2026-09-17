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
    
    const adminA = await prisma.user.create({
      data: { email: "adminA@example.com", fullName: "Admin A", role: "ADMIN", passwordHash, isActive: true }
    });
    const adminB = await prisma.user.create({
      data: { email: "adminB@example.com", fullName: "Admin B", role: "ADMIN", passwordHash, isActive: true }
    });
    
    const loginA = await request(app).post("/api/auth/login").send({ email: "adminA@example.com", password: "Password123!" });
    const cookieA = loginA.headers["set-cookie"]?.[0] || "";
    
    const loginB = await request(app).post("/api/auth/login").send({ email: "adminB@example.com", password: "Password123!" });
    const cookieB = loginB.headers["set-cookie"]?.[0] || "";
    
    // Ensure only A and B are active
    await prisma.user.updateMany({
      where: { role: "ADMIN", id: { notIn: [adminA.id, adminB.id] } },
      data: { isActive: false }
    });
    
    // Inject a small delay in requireAuth's findUnique to ensure both requests 
    // pass authentication before either transaction can commit and deactivate the user.
    const originalFindUnique = prisma.user.findUnique;
    const findSpy = vi.spyOn(prisma.user, 'findUnique').mockImplementation(async (args) => {
      if (args.where && args.where.id && Object.keys(args.where).length === 1) {
        await new Promise(r => setTimeout(r, 50));
      }
      return originalFindUnique.call(prisma.user, args);
    });
    
    const server = app.listen(0);
    const port = (server.address() as any).port;
    
    const [res1, res2] = await Promise.all([
      fetch(`http://localhost:${port}/api/admin/users/${adminB.id}`, { 
        method: 'PUT', 
        headers: { 'Cookie': cookieA, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ isActive: false }) 
      }),
      fetch(`http://localhost:${port}/api/admin/users/${adminA.id}`, { 
        method: 'PUT', 
        headers: { 'Cookie': cookieB, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ isActive: false }) 
      })
    ]);
    
    server.close();
    
    const statuses = [res1.status, res2.status].sort();
    
    // Exactly one succeeds (200), exactly one fails with conflict (409), validation (400), or unauthorized (401 due to race)
    expect(statuses[0]).toBe(200);
    expect([400, 401, 409]).toContain(statuses[1]);
    
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    expect(activeAdmins).toBe(1);
    
    // Restore
    await prisma.user.updateMany({
      where: { role: "ADMIN", id: { notIn: [adminA.id, adminB.id] } },
      data: { isActive: true }
    });
    await prisma.user.deleteMany({ where: { id: { in: [adminA.id, adminB.id] } } });
  });
});
