import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";
import bcrypt from "bcryptjs";

const prisma = getPrisma();

describe("Actions Taken API Tests (Lab 4 Part 6)", () => {
  let staffCookie1: string;
  let staffCookie2: string;
  let requesterCookie1: string;
  let requesterCookie2: string;
  let adminCookie: string;

  let staffUser1: any;
  let staffUser2: any;
  let inactiveStaff: any;
  let requesterUser1: any;
  let requesterUser2: any;
  let adminUser: any;

  let testTicket: any;
  let otherTicket: any;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const testSuffix = Date.now().toString();

    // Create test users
    staffUser1 = await prisma.user.create({
      data: {
        email: `staff1_${testSuffix}@test.local`,
        fullName: "Staff One",
        role: "IT_STAFF",
        passwordHash,
        isActive: true,
      },
    });

    staffUser2 = await prisma.user.create({
      data: {
        email: `staff2_${testSuffix}@test.local`,
        fullName: "Staff Two",
        role: "IT_STAFF",
        passwordHash,
        isActive: true,
      },
    });

    inactiveStaff = await prisma.user.create({
      data: {
        email: `inactive_staff_${testSuffix}@test.local`,
        fullName: "Inactive Staff",
        role: "IT_STAFF",
        passwordHash,
        isActive: false,
      },
    });

    requesterUser1 = await prisma.user.create({
      data: {
        email: `req1_${testSuffix}@test.local`,
        fullName: "Requester One",
        role: "REQUESTER",
        passwordHash,
        isActive: true,
      },
    });

    requesterUser2 = await prisma.user.create({
      data: {
        email: `req2_${testSuffix}@test.local`,
        fullName: "Requester Two",
        role: "REQUESTER",
        passwordHash,
        isActive: true,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin_${testSuffix}@test.local`,
        fullName: "Admin User",
        role: "ADMIN",
        passwordHash,
        isActive: true,
      },
    });

    // Login users
    const l1 = await request(app).post("/api/auth/login").send({ email: staffUser1.email, password: "Password123!" });
    staffCookie1 = l1.headers["set-cookie"][0];

    const l2 = await request(app).post("/api/auth/login").send({ email: staffUser2.email, password: "Password123!" });
    staffCookie2 = l2.headers["set-cookie"][0];

    const r1 = await request(app).post("/api/auth/login").send({ email: requesterUser1.email, password: "Password123!" });
    requesterCookie1 = r1.headers["set-cookie"][0];

    const r2 = await request(app).post("/api/auth/login").send({ email: requesterUser2.email, password: "Password123!" });
    requesterCookie2 = r2.headers["set-cookie"][0];

    const adm = await request(app).post("/api/auth/login").send({ email: adminUser.email, password: "Password123!" });
    adminCookie = adm.headers["set-cookie"][0];

    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst();

    // Create tickets
    testTicket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-ACT-${testSuffix}`,
        summary: "Actions Taken Test Ticket",
        description: "Testing actions taken functionality",
        categoryId: category!.id,
        relatedSystemId: system!.id,
        requesterId: requesterUser1.id,
        ownerId: staffUser1.id,
        currentStatus: "IN_PROGRESS",
      },
    });

    otherTicket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-OTH-${testSuffix}`,
        summary: "Other Ticket for Non-Enumeration",
        description: "Requested by user 2",
        categoryId: category!.id,
        relatedSystemId: system!.id,
        requesterId: requesterUser2.id,
        ownerId: staffUser2.id,
        currentStatus: "OPEN",
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testTicket) {
      await prisma.idempotencyRecord.deleteMany({ where: { ticketId: { in: [testTicket.id, otherTicket.id] } } });
      await prisma.actionTakenRevision.deleteMany({ where: { actionTaken: { ticketId: { in: [testTicket.id, otherTicket.id] } } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: [testTicket.id, otherTicket.id] } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: [testTicket.id, otherTicket.id] } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: [testTicket.id, otherTicket.id] } } });
      await prisma.ticket.deleteMany({ where: { id: { in: [testTicket.id, otherTicket.id] } } });
    }

    const userIds = [staffUser1?.id, staffUser2?.id, inactiveStaff?.id, requesterUser1?.id, requesterUser2?.id, adminUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  describe("POST /api/tickets/:id/actions-taken", () => {
    it("should successfully record an Action Taken by IT Staff with auto-attribution and active assignee", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          description: "Diagnosed gateway packet loss.",
          result: "Identified faulty transceiver module.",
          followUpRequired: true,
          followUpNote: "Order replacement SFP+ module.",
          attachmentNotes: "Log capture saved to syslog-server.",
          assignedToId: staffUser2.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Action taken recorded successfully");
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.ticketId).toBe(testTicket.id);
      expect(res.body.data.performedById).toBe(staffUser1.id);
      expect(res.body.data.performedBy.fullName).toBe("Staff One");
      expect(res.body.data.assignedToId).toBe(staffUser2.id);
      expect(res.body.data.assignedTo.fullName).toBe("Staff Two");
      expect(res.body.data.followUpRequired).toBe(true);
      expect(res.body.data.followUpNote).toBe("Order replacement SFP+ module.");
    });

    it("should ignore client-supplied performedById and enforce authenticated user session (spoof prevention)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          performedById: staffUser2.id, // Attempt to spoof staff2
          description: "Attempted spoof action.",
          result: "Transceiver checked.",
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.performedById).toBe(staffUser1.id);
      expect(res.body.data.performedById).not.toBe(staffUser2.id);
    });

    it("should allow collaborative action recording by non-owner staff member", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie2) // staff2 is not owner (owner is staff1)
        .send({
          description: "Assisted with cable replacement.",
          result: "Patch cable replaced.",
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.performedById).toBe(staffUser2.id);
    });

    it("should reject creation when mandatory fields (description, result) are missing", async () => {
      const res1 = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          result: "Some result",
          followUpRequired: false,
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("VALIDATION_ERROR");

      const res2 = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          description: "Some description",
          result: "   ",
          followUpRequired: false,
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("VALIDATION_ERROR");
    });

    const validBody = { description: "Valid description", result: "Valid result", followUpRequired: false };
    const postInvalid = (override: Record<string, unknown>) =>
      request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({ ...validBody, ...override });

    it.each([
      ["malformed actionDateTime", { actionDateTime: "not-a-date" }],
      ["non-string actionDateTime", { actionDateTime: 12345 }],
      ["actionDateTime more than 5 minutes in the future", { actionDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
      ["non-string attachmentNotes", { attachmentNotes: 123 }],
      ["non-string followUpNote", { followUpNote: { text: "x" } }],
      ["non-string assignedToId", { assignedToId: 42 }],
      ["description shorter than 5 characters", { description: "abcd" }],
      ["description longer than 3000 characters", { description: "a".repeat(3001) }],
      ["result shorter than 2 characters", { result: "a" }],
      ["result longer than 1000 characters", { result: "a".repeat(1001) }],
      ["attachmentNotes longer than 1000 characters", { attachmentNotes: "a".repeat(1001) }],
      ["followUpNote longer than 1000 characters", { followUpRequired: true, followUpNote: "a".repeat(1001) }],
    ])("should reject %s with 400 VALIDATION_ERROR (not 500)", async (_label, override) => {
      const res = await postInvalid(override);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should accept a client-supplied actionDateTime within the 5 minute future tolerance", async () => {
      const res = await postInvalid({ actionDateTime: new Date(Date.now() + 60 * 1000).toISOString() });
      expect(res.status).toBe(201);
    });

    it("should default followUpRequired to false when omitted on create (BR-04)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({ description: "No follow-up flag supplied", result: "Recorded without flag" });

      expect(res.status).toBe(201);
      expect(res.body.data.followUpRequired).toBe(false);
      const stored = await prisma.actionTaken.findUnique({ where: { id: res.body.data.id } });
      expect(stored!.followUpRequired).toBe(false);
    });

    it.each([
      ["a string", "yes"],
      ["null", null],
    ])("should reject followUpRequired supplied as %s with 400 VALIDATION_ERROR", async (_label, value) => {
      const res = await postInvalid({ followUpRequired: value });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should treat an omitted followUpRequired and an explicit false as the same idempotent request", async () => {
      const key = `idem-default-${Date.now()}`;
      const base = { description: "Default flag idempotency", result: "Recorded" };
      const first = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", key)
        .send(base);
      expect(first.status).toBe(201);

      const replay = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", key)
        .send({ ...base, followUpRequired: false });
      expect(replay.status).toBe(201);
      expect(replay.body.data.id).toBe(first.body.data.id);
    });

    it.each([
      ["an array", "[]"],
      ["a number", "5"],
      ["a string", '"text"'],
      ["null", "null"],
    ])("should respond 400 (never 500) when the POST body is %s", async (_label, raw) => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Content-Type", "application/json")
        .send(raw);
      // Scalars and null are rejected by express.json() (strict) before the route; arrays reach the route guard.
      expect(res.status).toBe(400);
    });

    it("should return the JSON VALIDATION_ERROR contract when the POST body is a JSON array", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Content-Type", "application/json")
        .send("[]");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should require followUpNote when followUpRequired is true", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          description: "Action needing follow up",
          result: "Temporary workaround applied",
          followUpRequired: true,
          // followUpNote omitted
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toContain("followUpNote is required");
    });

    it("should reject assignment to an inactive user (INACTIVE_ASSIGNEE)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          description: "Assigned to inactive tech",
          result: "Pending response",
          followUpRequired: false,
          assignedToId: inactiveStaff.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INACTIVE_ASSIGNEE");
    });

    it("should reject assignment to a user with role REQUESTER (INVALID_ASSIGNEE_ROLE)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .send({
          description: "Assigned to requester",
          result: "Invalid",
          followUpRequired: false,
          assignedToId: requesterUser1.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_ASSIGNEE_ROLE");
    });

    it("should reject Requester role with 403 Forbidden", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", requesterCookie1)
        .send({
          description: "Requester trying to record action",
          result: "Should fail",
          followUpRequired: false,
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Idempotency Persistence (FR-25 / BR-14 / §5.7)", () => {
    const idempotencyKey = `idem-${Date.now()}`;
    const payload = {
      description: "Idempotent action verification",
      result: "Confirmed operation",
      followUpRequired: false,
    };

    it("should create ActionTaken and persist an IdempotencyRecord row in the database", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", idempotencyKey)
        .send(payload);

      expect(res.status).toBe(201);
      const actionId = res.body.data.id;

      // Verify row is persisted in IdempotencyRecord table
      const record = await prisma.idempotencyRecord.findUnique({
        where: {
          userId_endpoint_ticketId_key: {
            userId: staffUser1.id,
            endpoint: "POST /api/tickets/:id/actions-taken",
            ticketId: testTicket.id,
            key: idempotencyKey,
          },
        },
      });

      expect(record).not.toBeNull();
      expect(record!.actionTakenId).toBe(actionId);
      expect(record!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should replay the original 201 response on retry with same key and identical payload without creating a duplicate record", async () => {
      const countBefore = await prisma.actionTaken.count({ where: { ticketId: testTicket.id } });

      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", idempotencyKey)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Action taken recorded successfully");

      const countAfter = await prisma.actionTaken.count({ where: { ticketId: testTicket.id } });
      expect(countAfter).toBe(countBefore);
    });

    it("should return 409 IDEMPOTENCY_KEY_CONFLICT when same key is submitted with different payload", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          description: "Different payload with identical key",
          result: "Should conflict",
          followUpRequired: false,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    });

    it("should return 409 IDEMPOTENCY_KEY_CONFLICT when only actionDateTime differs for the same key", async () => {
      const key = `idem-date-${Date.now()}`;
      const base = { description: "Date-sensitive idempotent action", result: "Recorded", followUpRequired: false };
      const first = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", key)
        .send({ ...base, actionDateTime: "2026-01-01T10:00:00.000Z" });
      expect(first.status).toBe(201);

      const changedDate = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", key)
        .send({ ...base, actionDateTime: "2026-01-01T11:00:00.000Z" });
      expect(changedDate.status).toBe(409);
      expect(changedDate.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");

      // Same instant written in another ISO form is the same request and replays safely.
      const sameInstant = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1)
        .set("Idempotency-Key", key)
        .send({ ...base, actionDateTime: "2026-01-01T10:00:00Z" });
      expect(sameInstant.status).toBe(201);
      expect(sameInstant.body.data.id).toBe(first.body.data.id);
    });

    it("should allow identical key from different user independently", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie2) // Different user
        .set("Idempotency-Key", idempotencyKey)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.performedById).toBe(staffUser2.id);
    });

    it("should handle concurrent identical requests via Promise.all creating exactly one ActionTaken", async () => {
      const concurrentKey = `concurrent-${Date.now()}`;
      const concurrentPayload = {
        description: "Concurrent submission test",
        result: "Tested concurrency",
        followUpRequired: false,
      };

      const [r1, r2] = await Promise.all([
        request(app)
          .post(`/api/tickets/${testTicket.id}/actions-taken`)
          .set("Cookie", staffCookie1)
          .set("Idempotency-Key", concurrentKey)
          .send(concurrentPayload),
        request(app)
          .post(`/api/tickets/${testTicket.id}/actions-taken`)
          .set("Cookie", staffCookie1)
          .set("Idempotency-Key", concurrentKey)
          .send(concurrentPayload),
      ]);

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r1.body.data.id).toBe(r2.body.data.id);
    });
  });

  describe("PATCH /api/actions-taken/:actionId (Optimistic Concurrency & Append-Only Revisions)", () => {
    let actionRecord: any;

    beforeAll(async () => {
      actionRecord = await prisma.actionTaken.create({
        data: {
          ticketId: testTicket.id,
          performedById: staffUser1.id,
          description: "Initial action description before patch",
          result: "Initial result",
          followUpRequired: true,
          followUpNote: "Initial note",
        },
      });
    });

    it("should reject update if expectedUpdatedAt is omitted (MISSING_EXPECTED_UPDATED_AT)", async () => {
      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", staffCookie1)
        .send({
          description: "Attempt update without expectedUpdatedAt",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MISSING_EXPECTED_UPDATED_AT");
    });

    it.each([
      ["malformed actionDateTime", { actionDateTime: "not-a-date" }],
      ["null actionDateTime", { actionDateTime: null }],
      ["non-string actionDateTime", { actionDateTime: 12345 }],
      ["actionDateTime more than 5 minutes in the future", { actionDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
      ["non-string attachmentNotes", { attachmentNotes: 123 }],
      ["non-string followUpNote", { followUpNote: { text: "x" } }],
      ["non-string assignedToId", { assignedToId: 42 }],
      ["description shorter than 5 characters", { description: "abcd" }],
      ["description longer than 3000 characters", { description: "a".repeat(3001) }],
      ["result longer than 1000 characters", { result: "a".repeat(1001) }],
      ["attachmentNotes longer than 1000 characters", { attachmentNotes: "a".repeat(1001) }],
    ])("should reject PATCH with %s as 400 VALIDATION_ERROR and create no revision", async (_label, override) => {
      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", staffCookie1)
        .send({ expectedUpdatedAt: actionRecord.updatedAt.toISOString(), ...override });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(await prisma.actionTakenRevision.count({ where: { actionTakenId: actionRecord.id } })).toBe(0);
    });

    it.each([
      ["an array", "[]"],
      ["null", "null"],
    ])("should respond 400 (never 500) when the PATCH body is %s", async (_label, raw) => {
      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", staffCookie1)
        .set("Content-Type", "application/json")
        .send(raw);
      expect(res.status).toBe(400);
    });

    it("should return the JSON VALIDATION_ERROR contract when the PATCH body is a JSON array", async () => {
      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", staffCookie1)
        .set("Content-Type", "application/json")
        .send("[]");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should successfully update ActionTaken and atomically append ActionTakenRevision", async () => {
      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", staffCookie2)
        .send({
          expectedUpdatedAt: actionRecord.updatedAt.toISOString(),
          description: "Updated description after second review",
          result: "Updated result",
          followUpRequired: false,
          followUpNote: null,
          assignedToId: staffUser2.id,
          performedById: staffUser2.id, // should be ignored!
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Action taken updated successfully");
      expect(res.body.data.description).toBe("Updated description after second review");
      expect(res.body.data.performedById).toBe(staffUser1.id); // original author immutable
      expect(res.body.data.assignedToId).toBe(staffUser2.id);
      expect(res.body.data.latestRevision).toBeDefined();
      expect(res.body.data.latestRevision.revisionNumber).toBe(1);
      expect(res.body.data.latestRevision.editedById).toBe(staffUser2.id);

      // Verify revision in database
      const revisions = await prisma.actionTakenRevision.findMany({
        where: { actionTakenId: actionRecord.id },
      });
      expect(revisions.length).toBe(1);
      expect(revisions[0].revisionNumber).toBe(1);
      expect(revisions[0].editedById).toBe(staffUser2.id);
      expect((revisions[0].originalData as any).description).toBe("Initial action description before patch");
      expect((revisions[0].updatedData as any).description).toBe("Updated description after second review");
    });

    it("should reject stale update with 409 STALE_UPDATE and create no revision", async () => {
      // Re-use old updatedAt
      const staleUpdatedAt = actionRecord.updatedAt.toISOString();

      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", staffCookie1)
        .send({
          expectedUpdatedAt: staleUpdatedAt,
          description: "Stale update attempt",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("STALE_UPDATE");

      // Verify revision count did not increase
      const revisions = await prisma.actionTakenRevision.findMany({
        where: { actionTakenId: actionRecord.id },
      });
      expect(revisions.length).toBe(1);
    });

    it("should handle two concurrent PATCH requests with same expectedUpdatedAt resulting in 1 success and 1 STALE_UPDATE", async () => {
      // Fetch latest action state
      const current = await prisma.actionTaken.findUnique({ where: { id: actionRecord.id } });
      const currentExpected = current!.updatedAt.toISOString();

      const [r1, r2] = await Promise.all([
        request(app)
          .patch(`/api/actions-taken/${actionRecord.id}`)
          .set("Cookie", staffCookie1)
          .send({
            expectedUpdatedAt: currentExpected,
            description: "Concurrent Winner 1",
          }),
        request(app)
          .patch(`/api/actions-taken/${actionRecord.id}`)
          .set("Cookie", staffCookie2)
          .send({
            expectedUpdatedAt: currentExpected,
            description: "Concurrent Loser 2",
          }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const winningRes = r1.status === 200 ? r1 : r2;
      const failingRes = r1.status === 409 ? r1 : r2;
      expect(failingRes.body.error.code).toBe("STALE_UPDATE");

      // Verify winning update was not overwritten
      const dbAfter = await prisma.actionTaken.findUnique({ where: { id: actionRecord.id } });
      expect(dbAfter!.description).toBe(winningRes.body.data.description);
    });

    it("should reject Requester from updating ActionTaken with 403 Forbidden", async () => {
      const current = await prisma.actionTaken.findUnique({ where: { id: actionRecord.id } });
      const res = await request(app)
        .patch(`/api/actions-taken/${actionRecord.id}`)
        .set("Cookie", requesterCookie1)
        .send({
          expectedUpdatedAt: current!.updatedAt.toISOString(),
          description: "Requester update attempt",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/tickets/:id/actions-taken", () => {
    it("should return full actions list with nested revisions for IT Staff and Admin", async () => {
      const res = await request(app)
        .get(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", staffCookie1);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const actionWithRev = res.body.data.find((a: any) => a.revisions && a.revisions.length > 0);
      expect(actionWithRev).toBeDefined();
      expect(actionWithRev.revisions[0].originalData).toBeDefined();
      expect(actionWithRev.revisions[0].updatedData).toBeDefined();
      expect(actionWithRev.revisions[0].editor).toBeDefined();
    });

    it("should allow Requester to view actions on own ticket but redact revision snapshots and editor info", async () => {
      const res = await request(app)
        .get(`/api/tickets/${testTicket.id}/actions-taken`)
        .set("Cookie", requesterCookie1);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const action of res.body.data) {
        expect(action.description).toBeDefined();
        expect(action.result).toBeDefined();
        expect(action.performedBy).toBeDefined();
        // Revision snapshots stripped
        expect(action.revisions).toBeUndefined();
      }
    });

    it("should return 404 for Requester attempting to access actions on non-owned ticket (non-enumeration)", async () => {
      const res = await request(app)
        .get(`/api/tickets/${otherTicket.id}/actions-taken`)
        .set("Cookie", requesterCookie1); // requester1 does not own otherTicket (requester2 does)

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("should respect sortBy and sortOrder query parameters", async () => {
      const resAsc = await request(app)
        .get(`/api/tickets/${testTicket.id}/actions-taken?sortBy=createdAt&sortOrder=asc`)
        .set("Cookie", staffCookie1);

      const resDesc = await request(app)
        .get(`/api/tickets/${testTicket.id}/actions-taken?sortBy=createdAt&sortOrder=desc`)
        .set("Cookie", staffCookie1);

      expect(resAsc.status).toBe(200);
      expect(resDesc.status).toBe(200);
      if (resAsc.body.data.length > 1) {
        const firstAsc = new Date(resAsc.body.data[0].createdAt).getTime();
        const lastAsc = new Date(resAsc.body.data[resAsc.body.data.length - 1].createdAt).getTime();
        expect(firstAsc).toBeLessThanOrEqual(lastAsc);

        const firstDesc = new Date(resDesc.body.data[0].createdAt).getTime();
        const lastDesc = new Date(resDesc.body.data[resDesc.body.data.length - 1].createdAt).getTime();
        expect(firstDesc).toBeGreaterThanOrEqual(lastDesc);
      }
    });
  });

  describe("DELETE Prohibition (HTTP 405 Method Not Allowed)", () => {
    it("should return HTTP 405 when attempting to delete an ActionTaken", async () => {
      const action = await prisma.actionTaken.findFirst({ where: { ticketId: testTicket.id } });
      const res = await request(app)
        .delete(`/api/actions-taken/${action!.id}`)
        .set("Cookie", staffCookie1);

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
    });

    it("should return HTTP 405 when attempting to mutate an ActionTakenRevision directly", async () => {
      const res1 = await request(app)
        .delete(`/api/action-taken-revisions/1`)
        .set("Cookie", staffCookie1);
      expect(res1.status).toBe(405);

      const res2 = await request(app)
        .put(`/api/action-taken-revisions/1`)
        .set("Cookie", staffCookie1)
        .send({ something: "test" });
      expect(res2.status).toBe(405);
    });
  });
});
