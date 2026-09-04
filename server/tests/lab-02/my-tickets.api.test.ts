import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

const mockTicketFindMany = vi.fn();
const mockTicketCount = vi.fn();

vi.mock("../../src/prisma.js", () => {
  return {
    getPrisma: vi.fn(() => ({
      ticket: {
        findMany: mockTicketFindMany,
        count: mockTicketCount
      }
    }))
  };
});

describe("GET /api/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockTicketFindMany.mockResolvedValue([
      {
        id: 101,
        ticketNumber: "TKT-2026-000101",
        summary: "Laptop battery drains quickly",
        category: { id: 2, name: "Hardware" },
        relatedSystem: { id: 7, name: "Corporate Laptop" },
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "NEW",
        createdAt: new Date("2026-09-02T10:15:30.000Z"),
        updatedAt: new Date("2026-09-02T10:15:30.000Z")
      }
    ]);
    
    mockTicketCount.mockResolvedValue(1);
  });

  it("should return a paginated list of tickets for the requester", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1");
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
    expect(response.body.data.length).toBe(1);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 8,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(mockTicketFindMany).toHaveBeenCalledWith({
      where: { requesterId: 1 },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 8,
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } }
      }
    });
  });

  it("should return 400 if X-Requester-Id is missing", async () => {
    const response = await request(app).get("/api/tickets");
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Missing X-Requester-Id header");
  });

  it("should return 400 if X-Requester-Id is invalid", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "invalid");
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid X-Requester-Id header");
  });

  it("should return 400 if pagination parameters are invalid", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ page: -1 });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid pagination parameters");
  });

  it("should apply search filter correctly", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ search: "battery" });
    
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { ticketNumber: { contains: "battery", mode: "insensitive" } },
          { summary: { contains: "battery", mode: "insensitive" } }
        ]
      })
    }));
  });

  it("should apply status, category, and priority filters individually", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ status: "OPEN" });
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ currentStatus: "OPEN" })
    }));

    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ categoryId: "2" });
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ categoryId: 2 })
    }));

    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ requestedPriority: "HIGH" });
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requestedPriority: "HIGH" })
    }));
  });

  it("should apply sorting in both asc and desc orders", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ sortBy: "ticketNumber", sortOrder: "asc" });
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { ticketNumber: "asc" }
    }));

    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ sortBy: "createdAt", sortOrder: "desc" });
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: "desc" }
    }));
  });

  it("should calculate pagination metadata correctly for multi-page requests", async () => {
    mockTicketCount.mockResolvedValue(25); // 25 total items
    
    // Page 2, PageSize 10
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ page: "2", pageSize: "10" });
    
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10
    }));
    
    expect(response.body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true
    });
  });

  it("should enforce strict cross-requester ownership boundaries", async () => {
    await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "42");
    
    expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requesterId: 42 }
    }));
  });
});
