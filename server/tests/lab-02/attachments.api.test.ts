import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import fs from "fs";
import path from "path";

const prisma = getPrisma();

describe("Attachments API Endpoints", () => {
  let requester1: any;
  let requester2: any;
  let ticket1: any;
  let ticket2: any;
  let testFilePath = path.join(process.cwd(), "tests", "test-file.pdf");
  let largeTestFilePath = path.join(process.cwd(), "tests", "large-file.pdf");
  let unsupportedFilePath = path.join(process.cwd(), "tests", "test-file.txt");

  beforeAll(async () => {
    requester1 = await prisma.developmentRequester.findFirst({ where: { id: 1 } });
    requester2 = await prisma.developmentRequester.findFirst({ where: { id: 2 } });
    
    if (!requester1 || !requester2) {
      throw new Error("Seed data not found for requesters");
    }

    const category = await prisma.category.findFirst();
    const relatedSystem = await prisma.relatedSystem.findFirst();

    ticket1 = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-ATT-000001",
        requesterId: requester1.id,
        categoryId: category!.id,
        relatedSystemId: relatedSystem!.id,
        summary: "Test Attachment Ticket 1",
        description: "Test description",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "NEW"
      }
    });

    ticket2 = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-ATT-000002",
        requesterId: requester2.id,
        categoryId: category!.id,
        relatedSystemId: relatedSystem!.id,
        summary: "Test Attachment Ticket 2",
        description: "Test description",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "NEW"
      }
    });

    // Create test files
    if (!fs.existsSync(path.dirname(testFilePath))) {
      fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    }
    fs.writeFileSync(testFilePath, "Dummy PDF content");
    fs.writeFileSync(unsupportedFilePath, "Dummy TXT content");
    
    // Create a 6MB file for size limit test
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
    fs.writeFileSync(largeTestFilePath, largeBuffer);
  });

  afterAll(async () => {
    await prisma.attachment.deleteMany({
      where: { ticketId: { in: [ticket1.id, ticket2.id] } }
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: [ticket1.id, ticket2.id] } }
    });

    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    if (fs.existsSync(unsupportedFilePath)) fs.unlinkSync(unsupportedFilePath);
    if (fs.existsSync(largeTestFilePath)) fs.unlinkSync(largeTestFilePath);
  });

  describe("POST /api/tickets/:id/attachments", () => {
    it("should successfully upload an attachment", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticket1.id}/attachments`)
        .set("x-requester-id", requester1.id.toString())
        .attach("file", testFilePath);
      
      expect(res.status).toBe(201);
      expect(res.body.data.originalFilename).toBe("test-file.pdf");
      expect(res.body.data.contentType).toBe("application/pdf");
    });

    it("should return 400 when file is missing", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticket1.id}/attachments`)
        .set("x-requester-id", requester1.id.toString());
      
      expect(res.status).toBe(400);
    });

    it("should return 403 when trying to upload to another requester's ticket", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticket2.id}/attachments`)
        .set("x-requester-id", requester1.id.toString())
        .attach("file", testFilePath);
      
      expect(res.status).toBe(403);
    });

    it("should return 413 or 400 when file exceeds 5MB limit", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticket1.id}/attachments`)
        .set("x-requester-id", requester1.id.toString())
        .attach("file", largeTestFilePath);
      
      expect(res.status).toBeGreaterThanOrEqual(400); // Usually 413, or 400 if mapped to VALIDATION_ERROR
      expect(res.body.error.code).toBe("FILE_TOO_LARGE");
    });

    it("should return 400 when file has unsupported type", async () => {
      const res = await request(app)
        .post(`/api/tickets/${ticket1.id}/attachments`)
        .set("x-requester-id", requester1.id.toString())
        .attach("file", unsupportedFilePath);
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("type"); // "Invalid file type"
    });

    it("should enforce the 5 active attachments limit", async () => {
      // We already uploaded 1 attachment in the first test.
      // Upload 4 more to reach the limit.
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post(`/api/tickets/${ticket1.id}/attachments`)
          .set("x-requester-id", requester1.id.toString())
          .attach("file", testFilePath);
        expect(res.status).toBe(201);
      }

      // 6th upload should fail
      const resReject = await request(app)
        .post(`/api/tickets/${ticket1.id}/attachments`)
        .set("x-requester-id", requester1.id.toString())
        .attach("file", testFilePath);
      
      expect(resReject.status).toBe(400);
      expect(resReject.body.error.code).toBe("ATTACHMENT_LIMIT_EXCEEDED");
    });
  });

  describe("Attachment Downloads and Soft-Removal", () => {
    let attachmentId: number;

    beforeAll(async () => {
      // Upload one attachment to ticket2 to test download and remove
      const res = await request(app)
        .post(`/api/tickets/${ticket2.id}/attachments`)
        .set("x-requester-id", requester2.id.toString())
        .attach("file", testFilePath);
      
      attachmentId = res.body.data.id;
    });

    it("should return 403 when trying to download another requester's attachment", async () => {
      const res = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("x-requester-id", requester1.id.toString());
      
      expect(res.status).toBe(403);
    });

    it("should successfully download attachment if owned", async () => {
      const res = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("x-requester-id", requester2.id.toString());
      
      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toBe("application/pdf");
    });

    it("should return 400 when missing removal reason on DELETE", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("x-requester-id", requester2.id.toString())
        .send({}); // missing removalReason
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MISSING_REMOVAL_REASON");
    });

    it("should return 403 when trying to soft-remove another requester's attachment", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("x-requester-id", requester1.id.toString())
        .send({ removalReason: "Wrong user deleting" });
      
      expect(res.status).toBe(403);
    });

    it("should successfully soft-remove attachment", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("x-requester-id", requester2.id.toString())
        .send({ removalReason: "Uploaded wrong file" });
      
      expect(res.status).toBe(200);
      expect(res.body.data.isRemoved).toBe(true);
      expect(res.body.data.removedReason).toBe("Uploaded wrong file");
    });

    it("should return 410 Gone when trying to download a soft-removed attachment", async () => {
      const res = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("x-requester-id", requester2.id.toString());
      
      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe("ATTACHMENT_REMOVED");
    });

    it("should return 400 when trying to soft-remove an already removed attachment", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("x-requester-id", requester2.id.toString())
        .send({ removalReason: "Try removing again" });
      
      expect(res.status).toBe(400);
    });
  });
});
