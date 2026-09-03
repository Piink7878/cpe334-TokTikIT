import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

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

  // Base Tests
  it("should create a ticket successfully and return 201", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("requesterId", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Laptop battery drains quickly")
      .field("description", "My laptop battery is draining much faster than usual.")
      .field("requestedPriority", "MEDIUM");
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.ticketNumber).toBe(`TKT-${new Date().getFullYear()}-000101`);
  });

  // Edge Cases
  it("should return 400 if X-Requester-Id is missing", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Test summary")
      .field("description", "Test description text.")
      .field("requestedPriority", "MEDIUM");
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Missing X-Requester-Id header");
  });

  it("should return 400 if requesterId in body does not match X-Requester-Id header", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("requesterId", "2") // Mismatch
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Valid summary here")
      .field("description", "Valid description here.")
      .field("requestedPriority", "MEDIUM");
    
    expect(response.status).toBe(400);
    expect(response.body.error.details.some((d: any) => d.field === "requesterId")).toBe(true);
  });

  it("should return 404 if relatedSystemId is not found", async () => {
    mockSystemFindUnique.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "99") // Not found
      .field("summary", "Valid summary here")
      .field("description", "Valid description here.")
      .field("requestedPriority", "MEDIUM");
    
    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Related system not found or inactive");
  });

  it("should return 400 if requestedPriority is invalid", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Valid summary here")
      .field("description", "Valid description here.")
      .field("requestedPriority", "SUPER_URGENT"); // Invalid
    
    expect(response.status).toBe(400);
    expect(response.body.error.details.some((d: any) => d.field === "requestedPriority")).toBe(true);
  });

  it("should return 400 for boundary violations of summary and description", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "A".repeat(151)) // > 150 chars
      .field("description", "B".repeat(3001)) // > 3000 chars
      .field("requestedPriority", "MEDIUM");
    
    expect(response.status).toBe(400);
    expect(response.body.error.details.some((d: any) => d.field === "summary")).toBe(true);
    expect(response.body.error.details.some((d: any) => d.field === "description")).toBe(true);
  });

  // Attachment Tests
  it("should return 400 if file is larger than 5MB", async () => {
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5MB + 1KB
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Valid summary here")
      .field("description", "Valid description here.")
      .field("requestedPriority", "MEDIUM")
      .attach("attachments", largeBuffer, "large.jpg");
      
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("should return 400 if unsupported file type is uploaded", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Valid summary here")
      .field("description", "Valid description here.")
      .field("requestedPriority", "MEDIUM")
      .attach("attachments", Buffer.from("just some text"), { filename: "test.txt", contentType: "text/plain" });
      
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe("Invalid file type");
  });

  it("should return 400 if more than 5 files are uploaded", async () => {
    const validBuffer = Buffer.from("fake image data");
    const req = request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "7")
      .field("summary", "Valid summary here")
      .field("description", "Valid description here.")
      .field("requestedPriority", "MEDIUM");
      
    for (let i = 0; i < 6; i++) {
      req.attach("attachments", validBuffer, { filename: `test${i}.jpg`, contentType: "image/jpeg" });
    }
    
    const response = await req;
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ATTACHMENT_LIMIT_EXCEEDED");
  });
});
