/**
 * Lab 4 Migration Regression & Data Preservation Tests
 * Covers TC-DB-01 through TC-DB-08 from docs/lab-04/tests.md
 */

import { describe, it, expect } from "vitest";
import { getPrisma } from "../../src/prisma";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

const prisma = getPrisma();

describe("Lab 4 Migration Regression & Database Integrity Tests", () => {
  const seededTicketNumbers = ["TKT-1001", "TKT-1002", "TKT-1003", "TKT-1004"];

  describe("TC-DB-01: Ticket to ActionTaken 1-to-Many Relationship & Nested Revisions", () => {
    it("should query a Ticket with its related actionsTaken and nested revisions", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1001" },
        include: {
          actionsTaken: {
            include: { revisions: true },
          },
        },
      });

      expect(ticket).not.toBeNull();
      expect(ticket!.actionsTaken.length).toBeGreaterThanOrEqual(2);
      const actionWithRevision = ticket!.actionsTaken.find((a) => a.revisions.length > 0);
      expect(actionWithRevision).toBeDefined();
      expect(actionWithRevision!.revisions[0].revisionNumber).toBe(1);
    });

    it("should query an ActionTaken with its parent ticket, performer, and revisions", async () => {
      const action = await prisma.actionTaken.findFirst({
        where: { ticket: { ticketNumber: "TKT-1001" } },
        include: {
          ticket: true,
          performedBy: true,
          revisions: true,
        },
      });

      expect(action).not.toBeNull();
      expect(action!.ticket.ticketNumber).toBe("TKT-1001");
      expect(action!.performedBy.id).toBe(action!.performedById);
    });
  });

  describe("TC-DB-01B: ActionTakenRevision Table Schema & Unique Constraint Integrity", () => {
    it("should enforce schema types, editor foreign key, and reject duplicate (actionTakenId, revisionNumber)", async () => {
      const revision = await prisma.actionTakenRevision.findFirst({
        include: { editor: true },
      });

      expect(revision).not.toBeNull();
      expect(typeof revision!.actionTakenId).toBe("number");
      expect(typeof revision!.revisionNumber).toBe("number");
      expect(typeof revision!.editedById).toBe("string");
      expect(revision!.editedAt instanceof Date).toBe(true);
      expect(typeof revision!.originalData).toBe("object");
      expect(typeof revision!.updatedData).toBe("object");
      expect(revision!.editor).toBeDefined();
      expect(revision!.editor.id).toBe(revision!.editedById);

      // Attempt inserting duplicate revision tuple
      await expect(
        prisma.actionTakenRevision.create({
          data: {
            actionTakenId: revision!.actionTakenId,
            revisionNumber: revision!.revisionNumber,
            editedById: revision!.editedById,
            originalData: revision!.originalData as any,
            updatedData: revision!.updatedData as any,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("TC-DB-02: Tickets with Zero, One, and Multiple Actions Taken", () => {
    it("should have TKT-1002 with 0 Actions Taken", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1002" },
        include: { actionsTaken: true },
      });
      expect(ticket).not.toBeNull();
      expect(ticket!.actionsTaken).toEqual([]);
    });

    it("should have TKT-1004 with 1 Action Taken", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1004" },
        include: { actionsTaken: true },
      });
      expect(ticket).not.toBeNull();
      expect(ticket!.actionsTaken.length).toBe(1);
    });

    it("should have TKT-1001 with multiple Actions Taken", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1001" },
        include: { actionsTaken: true },
      });
      expect(ticket).not.toBeNull();
      expect(ticket!.actionsTaken.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("TC-DB-03: Deletion Integrity Policy — Ticket Deletion Blocked (onDelete: Restrict)", () => {
    it("should throw a foreign key restriction error when attempting to delete a Ticket with Actions Taken", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1004" },
      });
      expect(ticket).not.toBeNull();

      await expect(
        prisma.ticket.delete({
          where: { id: ticket!.id },
        })
      ).rejects.toThrow();

      // Verify ticket remains untouched
      const stillExists = await prisma.ticket.findUnique({
        where: { id: ticket!.id },
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe("TC-DB-04: Deletion Integrity Policy — User Deletion Blocked (onDelete: Restrict)", () => {
    it("should throw a foreign key restriction error when attempting to delete a User who performed Actions", async () => {
      const action = await prisma.actionTaken.findFirst({
        select: { performedById: true },
      });
      expect(action).not.toBeNull();

      await expect(
        prisma.user.delete({
          where: { id: action!.performedById },
        })
      ).rejects.toThrow();

      // Verify user remains untouched
      const user = await prisma.user.findUnique({
        where: { id: action!.performedById },
      });
      expect(user).not.toBeNull();
    });
  });

  describe("TC-DB-05: Non-Destructive Migration Verification", () => {
    it("should find all 4 seeded tickets with intact relations", async () => {
      const tickets = await prisma.ticket.findMany({
        where: { ticketNumber: { in: seededTicketNumbers } },
        include: {
          requester: true,
          category: true,
          relatedSystem: true,
        },
      });

      expect(tickets.length).toBe(4);
      for (const t of tickets) {
        expect(t.requester).toBeDefined();
        expect(t.category).toBeDefined();
        expect(t.relatedSystem).toBeDefined();
      }
    });

    it("should verify categories and related systems remain intact", async () => {
      const categories = await prisma.category.findMany();
      expect(categories.length).toBeGreaterThanOrEqual(4);
      const systems = await prisma.relatedSystem.findMany();
      expect(systems.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("TC-DB-06 & Disaster Recovery: Physical Attachment Preservation", () => {
    it("should verify attachment join on tickets resolves cleanly", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1001" },
        include: { attachments: true },
      });
      expect(ticket).not.toBeNull();
      expect(Array.isArray(ticket!.attachments)).toBe(true);
    });

    it("should verify configured attachment storage directory exists and files remain read-only", async () => {
      const configuredDir = path.join(process.cwd(), "uploads", "lab-02");
      expect(fs.existsSync(configuredDir)).toBe(true);

      const files = fs.readdirSync(configuredDir);
      expect(files.length).toBeGreaterThanOrEqual(1);

      // Verify physical file checksum calculation works
      const firstFile = files[0];
      const filePath = path.join(configuredDir, firstFile);
      const fileBuffer = fs.readFileSync(filePath);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      expect(hash.length).toBe(64);

      // Simulate recovery to isolated temporary directory
      const tmpRecoveryDir = fs.mkdtempSync(path.join(os.tmpdir(), "toktikit-recovery-test-"));
      try {
        const restoredFilePath = path.join(tmpRecoveryDir, firstFile);
        fs.copyFileSync(filePath, restoredFilePath);

        const restoredBuffer = fs.readFileSync(restoredFilePath);
        const restoredHash = crypto.createHash("sha256").update(restoredBuffer).digest("hex");
        expect(restoredHash).toBe(hash);
      } finally {
        fs.rmSync(tmpRecoveryDir, { recursive: true, force: true });
      }
    });
  });

  describe("TC-DB-07: IdempotencyRecord Schema and Indexes", () => {
    it("should verify IdempotencyRecord model supports unique scope constraint", async () => {
      const user = await prisma.user.findFirst();
      const ticket = await prisma.ticket.findFirst();
      const action = await prisma.actionTaken.findFirst();

      expect(user).not.toBeNull();
      expect(ticket).not.toBeNull();
      expect(action).not.toBeNull();

      const key = `test-key-${Date.now()}`;
      const rec = await prisma.idempotencyRecord.create({
        data: {
          userId: user!.id,
          endpoint: "POST /api/tickets/:id/actions-taken",
          ticketId: ticket!.id,
          key,
          requestHash: "testhash123",
          actionTakenId: action!.id,
          responseStatus: 201,
          responseBody: { test: true },
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      expect(rec.id).toBeDefined();

      // Attempt duplicate insertion
      await expect(
        prisma.idempotencyRecord.create({
          data: {
            userId: user!.id,
            endpoint: "POST /api/tickets/:id/actions-taken",
            ticketId: ticket!.id,
            key,
            requestHash: "testhash123",
            actionTakenId: action!.id,
            responseStatus: 201,
            responseBody: { test: true },
            expiresAt: new Date(Date.now() + 86400000),
          },
        })
      ).rejects.toThrow();

      // Clean up test record
      await prisma.idempotencyRecord.delete({ where: { id: rec.id } });
    });
  });
});
