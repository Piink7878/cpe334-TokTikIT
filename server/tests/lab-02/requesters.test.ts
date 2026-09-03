import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const mockFindMany = vi.fn().mockResolvedValue([
  { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
  { id: 2, name: "David Lee", email: "david.lee@example.com" }
]);

vi.mock("../../src/prisma.js", () => {
  return {
    getPrisma: vi.fn(() => ({
      developmentRequester: {
        findMany: mockFindMany
      }
    }))
  };
});

describe("GET /api/requesters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return active requesters and filter by isActive: true", async () => {
    const response = await request(app).get("/api/requesters");
    
    // Assert HTTP status and basic structure
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.length).toBe(2);
    
    // Check that Prisma was explicitly told to ONLY fetch isActive: true
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" }
    });
  });
});
