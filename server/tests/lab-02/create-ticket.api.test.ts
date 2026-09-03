import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Mock multer
vi.mock("../../src/middlewares/upload.js", () => {
  return {
    upload: {
      array: vi.fn(() => (req: any, res: any, next: any) => {
        // simulate a successful upload for test (no files attached)
        req.files = [];
        next();
      })
    }
  };
});

const mockCategoryFindUnique = vi.fn();
const mockSystemFindUnique = vi.fn();
const mockTicketFindFirst = vi.fn();
const mockTicketCreate = vi.fn();

vi.mock("../../src/prisma.js", () => {
  return {
    getPrisma: vi.fn(() => ({
      category: { findUnique: mockCategoryFindUnique },
      relatedSystem: { findUnique: mockSystemFindUnique },
      ticket: { findFirst: mockTicketFindFirst, create: mockTicketCreate }
    }))
  };
});

describe("POST /api/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFindUnique.mockResolvedValue({ id: 2, name: "Hardware", isActive: true });
    mockSystemFindUnique.mockResolvedValue({ id: 7, name: "Corporate Laptop", isActive: true });
    mockTicketFindFirst.mockResolvedValue({ ticketNumber: `TKT-${new Date().getFullYear()}-000100` });
    mockTicketCreate.mockResolvedValue({
      id: 101,
      ticketNumber: `TKT-${new Date().getFullYear()}-000101`,
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 7,
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining much faster than usual.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "NEW",
      createdAt: new Date("2026-09-02T10:15:30.000Z"),
      updatedAt: new Date("2026-09-02T10:15:30.000Z"),
      attachments: []
    });
  });

  it("should create a ticket successfully and return 201", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 7,
        summary: "Laptop battery drains quickly",
        description: "My laptop battery is draining much faster than usual.",
        requestedPriority: "MEDIUM"
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.ticketNumber).toBe(`TKT-${new Date().getFullYear()}-000101`);
  });

  it("should return 400 if X-Requester-Id is missing", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send({
        categoryId: 2,
        relatedSystemId: 7,
        summary: "Test",
        description: "Test description",
        requestedPriority: "MEDIUM"
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Missing X-Requester-Id header");
  });

  it("should return 400 if summary is too short", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({
        categoryId: 2,
        relatedSystemId: 7,
        summary: "a", // too short
        description: "My laptop battery is draining much faster than usual.",
        requestedPriority: "MEDIUM"
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.some((d: any) => d.field === "summary")).toBe(true);
  });

  it("should return 404 if category is inactive or missing", async () => {
    mockCategoryFindUnique.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({
        categoryId: 99,
        relatedSystemId: 7,
        summary: "Laptop battery drains quickly",
        description: "My laptop battery is draining much faster than usual.",
        requestedPriority: "MEDIUM"
      });
    
    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Category not found or inactive");
  });
});
