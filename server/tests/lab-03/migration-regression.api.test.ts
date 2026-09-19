/**
 * Migration Regression Tests (Lab 3) — MIG-01
 *
 * Purpose: Verify that the Lab 2 → Lab 3 schema migration preserved the seeded
 * Ticket records and their Ticket→User (requester) relationships.
 *
 * This test does NOT perform a re-migration. It queries the live database to
 * confirm that:
 *  - The seeded Lab 2 tickets (TKT-1001 through TKT-1004) are still present.
 *  - Their requesterId columns are NOT NULL and resolve to the correct seeded
 *    User email addresses (regression against migration step 3 and step 8 of
 *    migration.sql: newRequesterId mapping and NOT NULL enforcement).
 *  - The Attachment table is schema-compatible: the Ticket→Attachment
 *    foreign-key join is functional on TKT-1001.
 *
 * Coverage gap (documented): No Attachment rows are seeded in seed.ts or in
 * any migration SQL. Therefore this test cannot verify that a specific legacy
 * Attachment record was preserved; it can only verify that the schema join works.
 * If a seeded Attachment fixture is added to seed.ts in the future, this test
 * should be extended to assert its presence and fields.
 */

import { describe, it, expect } from "vitest";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

describe("Migration Regression Tests (MIG-01)", () => {
  // Known seeded ticket numbers from seed.ts
  const seededTicketNumbers = ["TKT-1001", "TKT-1002", "TKT-1003", "TKT-1004"];

  describe("Seeded tickets still exist after migration", () => {
    it("should find all four seeded tickets in the database", async () => {
      const tickets = await prisma.ticket.findMany({
        where: { ticketNumber: { in: seededTicketNumbers } },
        select: { ticketNumber: true },
      });

      const found = tickets.map((t) => t.ticketNumber);
      for (const num of seededTicketNumbers) {
        expect(found).toContain(num);
      }
    });
  });

  describe("Ticket requester relationships are intact after migration", () => {
    it("TKT-1001 should have a valid requester (req1@toktikit.local)", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1001" },
        include: { requester: { select: { email: true } } },
      });

      expect(ticket).not.toBeNull();
      expect(ticket!.requesterId).not.toBeNull();
      expect(ticket!.requester.email).toBe("req1@toktikit.local");
    });

    it("TKT-1002 should have a valid requester (req2@toktikit.local)", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1002" },
        include: { requester: { select: { email: true } } },
      });

      expect(ticket).not.toBeNull();
      expect(ticket!.requesterId).not.toBeNull();
      expect(ticket!.requester.email).toBe("req2@toktikit.local");
    });

    it("TKT-1003 should have a valid requester (req3@toktikit.local)", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1003" },
        include: { requester: { select: { email: true } } },
      });

      expect(ticket).not.toBeNull();
      expect(ticket!.requesterId).not.toBeNull();
      expect(ticket!.requester.email).toBe("req3@toktikit.local");
    });

    it("TKT-1004 should have a valid requester (req1@toktikit.local)", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1004" },
        include: { requester: { select: { email: true } } },
      });

      expect(ticket).not.toBeNull();
      expect(ticket!.requesterId).not.toBeNull();
      expect(ticket!.requester.email).toBe("req1@toktikit.local");
    });
  });

  describe("Attachment table schema compatibility after migration", () => {
    // NOTE: seed.ts does not seed any Attachment rows, and no migration SQL
    // INSERTs attachment data. Therefore there is no deterministic seeded
    // Attachment record to assert against. This test verifies only that the
    // Ticket→Attachment foreign-key join is functional (schema-level regression).
    it("Ticket→Attachment join on TKT-1001 must be resolvable without error", async () => {
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-1001" },
        include: { attachments: { select: { id: true, originalName: true, storedName: true, mimeType: true, isRemoved: true } } },
      });

      expect(ticket).not.toBeNull();
      // The join itself must succeed (schema intact). Absence of rows is expected
      // since no attachment seed data exists — this is a known coverage gap.
      expect(Array.isArray(ticket!.attachments)).toBe(true);
    });
  });
});
