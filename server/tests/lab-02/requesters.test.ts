import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { loginAsRequester, createMockUser } from "./test-utils.js";

const mockFindMany = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock("../../src/prisma.js", () => {
  return {
    getPrisma: vi.fn(() => ({
      user: {
        findMany: mockFindMany,
        findUnique: mockUserFindUnique
      }
    }))
  };
});

describe("GET /api/requesters", () => {
  let agent: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockFindMany.mockResolvedValue([
      { id: "1", fullName: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
      { id: "2", fullName: "David Lee", email: "david.lee@example.com" }
    ]);

    mockUserFindUnique.mockImplementation(async (args) => {
      if (args.where.email === "requester1@test.com") return createMockUser("1");
      if (args.where.id == 1) return createMockUser("1");
      return null;
    });

    agent = request.agent(app);
    await loginAsRequester(agent, 1);
  });

  it("should return active requesters and filter by role and isActive", async () => {
    const response = await agent.get("/api/requesters");
    
    // Assert HTTP status and basic structure
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.length).toBe(2);
    
    // Check that Prisma was explicitly told to ONLY fetch isActive: true and role: "REQUESTER"
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { role: "REQUESTER", isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { id: "asc" }
    });
  });

  it("should return 401 if unauthenticated", async () => {
    const response = await request(app).get("/api/requesters");
    expect(response.status).toBe(401);
  });
});
