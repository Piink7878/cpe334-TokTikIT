import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import bcrypt from "bcryptjs";

describe("Authentication API", () => {
  let activeUserCookie: string;
  let inactiveUserCookie: string;
  let initialPasswordUserCookie: string;
  
  beforeAll(async () => {
    const prisma = getPrisma();
    
    // Seed test users
    const hash = await bcrypt.hash("TestPass123!", 10);
    
    await prisma.user.upsert({
      where: { email: "active@test.com" },
      update: { passwordHash: hash, isActive: true, mustChangePassword: false, role: "REQUESTER" },
      create: {
        email: "active@test.com",
        fullName: "Active User",
        passwordHash: hash,
        isActive: true,
        mustChangePassword: false,
        role: "REQUESTER"
      }
    });

    await prisma.user.upsert({
      where: { email: "inactive@test.com" },
      update: { passwordHash: hash, isActive: false, mustChangePassword: false, role: "REQUESTER" },
      create: {
        email: "inactive@test.com",
        fullName: "Inactive User",
        passwordHash: hash,
        isActive: false,
        mustChangePassword: false,
        role: "REQUESTER"
      }
    });

    await prisma.user.upsert({
      where: { email: "initial@test.com" },
      update: { passwordHash: hash, isActive: true, mustChangePassword: true, role: "REQUESTER" },
      create: {
        email: "initial@test.com",
        fullName: "Initial User",
        passwordHash: hash,
        isActive: true,
        mustChangePassword: true,
        role: "REQUESTER"
      }
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.user.deleteMany({
      where: {
        email: { in: ["active@test.com", "inactive@test.com", "initial@test.com"] }
      }
    });
  });

  it("should fail login with wrong password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "active@test.com", password: "wrong" });
      
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("should reject inactive accounts without leaking account existence", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "inactive@test.com", password: "TestPass123!" });
      
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid email or password");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("should succeed login for active account and return secure cookie", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "active@test.com", password: "TestPass123!" });
      
    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe("active@test.com");
    expect(response.headers["set-cookie"]).toBeDefined();
    
    activeUserCookie = response.headers["set-cookie"][0];
    expect(activeUserCookie).toMatch(/HttpOnly/i);
    expect(activeUserCookie).toMatch(/SameSite=(Lax|Strict)/i);
    
    // In test environment (not production), Secure is false, so it shouldn't be present
    if (process.env.NODE_ENV === "production") {
      expect(activeUserCookie).toMatch(/Secure/i);
    } else {
      expect(activeUserCookie).not.toMatch(/Secure/i);
    }
    
    // Check expiration exists (Max-Age or Expires)
    expect(activeUserCookie).toMatch(/(Max-Age|Expires)=/i);
  });

  it("should retrieve current user via /api/auth/me", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", activeUserCookie);
      
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("active@test.com");
    expect(response.body.user.mustChangePassword).toBe(false);
  });
  
  it("should login user with mustChangePassword flag and block protected endpoints", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "initial@test.com", password: "TestPass123!" });
      
    expect(response.status).toBe(200);
    expect(response.body.user.mustChangePassword).toBe(true);
    initialPasswordUserCookie = response.headers["set-cookie"][0];

    // Verify protected endpoint is blocked (403)
    const blockedRes = await request(app)
      .get("/api/tickets")
      .set("Cookie", initialPasswordUserCookie);
    
    // Depending on implementation, it might be 403 Forbidden
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.error.message).toContain("You must change your password");
  });

  it("should allow password change with correct current password and unblock endpoints", async () => {
    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", initialPasswordUserCookie)
      .send({
        currentPassword: "TestPass123!",
        newPassword: "NewPass123!@",
        confirmPassword: "NewPass123!@"
      });
      
    expect(response.status).toBe(200);
    
    // Verify it updated the DB
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", initialPasswordUserCookie);
    expect(meResponse.body.user.mustChangePassword).toBe(false);

    // Verify protected endpoint is now accessible
    const successRes = await request(app)
      .get("/api/tickets")
      .set("Cookie", initialPasswordUserCookie);
    expect(successRes.status).not.toBe(403); // Assuming 200 OK since it's the tickets endpoint
  });
  
  it("should reject password change if complexity fails", async () => {
    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", activeUserCookie)
      .send({
        currentPassword: "TestPass123!",
        newPassword: "weak",
        confirmPassword: "weak"
      });
      
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("at least 8 characters");
  });

  it("should logout successfully", async () => {
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", activeUserCookie);
      
    expect(response.status).toBe(200);
    
    // verify session is dead
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", activeUserCookie);
    expect(meResponse.status).toBe(401);
  });

  describe("Negative Authentication Tests (Unauthenticated)", () => {
    it("should return 401 Unauthorized when unauthenticated for GET /api/auth/me", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("should return 401 Unauthorized when unauthenticated for POST /api/auth/logout", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(401);
    });

    it("should return 401 Unauthorized when unauthenticated for POST /api/auth/change-password", async () => {
      const res = await request(app)
        .post("/api/auth/change-password")
        .send({ currentPassword: "OldPassword123!", newPassword: "NewPassword123!", confirmPassword: "NewPassword123!" });
      expect(res.status).toBe(401);
    });
  });
});
