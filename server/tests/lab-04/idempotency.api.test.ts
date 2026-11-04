import request from "supertest";
import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "lab-02");
const uploadedFileCount = () => fs.readdirSync(UPLOADS_DIR).length;

// Safe network retries (Issue 6 review): creating a ticket, a public comment or an internal note with an
// Idempotency-Key must create the record exactly once, however many times the request is sent.
describe("Idempotent creation of tickets, comments and internal notes", () => {
  const suffix = Date.now().toString();
  const password = "Password123!";
  let requester: any;
  let otherRequester: any;
  let staff: any;
  let cookies: Record<string, string> = {};
  let categoryId: number;
  let systemId: number;
  let ticketId: number;
  let keyCounter = 0;
  const key = () => `retry-${suffix}-${keyCounter++}`;

  const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password })).headers["set-cookie"][0] as string;

  type Endpoint = {
    name: string;
    role: "requester" | "staff";
    send: (idemKey: string | null, content: string, cookie?: string) => request.Test;
    count: () => Promise<number>;
  };

  const withKey = (req: request.Test, idemKey: string | null) => (idemKey === null ? req : req.set("Idempotency-Key", idemKey));

  const ticketFields = (summary: string) => ({
    categoryId: String(categoryId),
    relatedSystemId: String(systemId),
    requestedPriority: "HIGH",
    summary,
    description: "A description with enough characters to pass validation."
  });
  const postTicket = (idemKey: string | null, summary: string, cookie = cookies.requester) => {
    let req = withKey(request(app).post("/api/tickets").set("Cookie", cookie), idemKey);
    for (const [k, v] of Object.entries(ticketFields(summary))) req = req.field(k, v);
    return req;
  };

  const endpoints: Endpoint[] = [
    {
      name: "ticket",
      role: "requester",
      send: (idemKey, content, cookie) => postTicket(idemKey, content, cookie),
      count: () => prisma.ticket.count({ where: { requesterId: { in: [requester.id, otherRequester.id] }, ticketNumber: { startsWith: "TKT-" }, summary: { startsWith: `Idem ${suffix}` } } })
    },
    {
      name: "public comment",
      role: "requester",
      send: (idemKey, content, cookie = cookies.requester) =>
        withKey(request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", cookie), idemKey).send({ content }),
      count: () => prisma.publicComment.count({ where: { ticketId, content: { startsWith: `Idem ${suffix}` } } })
    },
    {
      name: "internal note",
      role: "staff",
      send: (idemKey, content, cookie = cookies.staff) =>
        withKey(request(app).post(`/api/tickets/${ticketId}/internal-notes`).set("Cookie", cookie), idemKey).send({ content }),
      count: () => prisma.internalNote.count({ where: { ticketId, content: { startsWith: `Idem ${suffix}` } } })
    }
  ];
  const text = (label: string) => `Idem ${suffix} ${label} ${keyCounter}`;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    const mk = (role: any, name: string) =>
      prisma.user.create({ data: { email: `${name}_${suffix}@idem.local`, fullName: name, role, passwordHash, isActive: true } });
    requester = await mk("REQUESTER", "idemreq");
    otherRequester = await mk("REQUESTER", "idemreq2");
    staff = await mk("IT_STAFF", "idemstaff");
    for (const [k, u] of Object.entries({ requester, otherRequester, staff })) cookies[k] = await login((u as any).email);
    categoryId = (await prisma.category.findFirst())!.id;
    systemId = (await prisma.relatedSystem.findFirst())!.id;
    ticketId = (
      await prisma.ticket.create({
        data: {
          ticketNumber: `ID-${suffix}`,
          summary: "Idempotency host ticket",
          description: "Idempotency host ticket description",
          categoryId,
          relatedSystemId: systemId,
          requesterId: requester.id,
          currentStatus: "OPEN",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM"
        }
      })
    ).id;
  });

  afterAll(async () => {
    const tickets = await prisma.ticket.findMany({ where: { OR: [{ requesterId: { in: [requester.id, otherRequester.id] } }] }, include: { attachments: true } });
    for (const t of tickets) for (const a of t.attachments) fs.unlink(path.join(UPLOADS_DIR, a.storedName), () => {});
    const ids = tickets.map((t) => t.id);
    await prisma.requestIdempotency.deleteMany({ where: { userId: { in: [requester.id, otherRequester.id, staff.id] } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: [requester.id, otherRequester.id, staff.id] } } });
  });

  describe.each(endpoints)("$name", (ep) => {
    it("replays the stored response for a retry with the same key and payload, creating nothing new", async () => {
      const k = key();
      const content = text(ep.name);
      const before = await ep.count();

      const first = await ep.send(k, content);
      expect(first.status).toBe(201);
      const retry = await ep.send(k, content);

      expect(retry.status).toBe(201);
      expect(retry.body).toEqual(first.body);
      expect(retry.headers["idempotent-replay"]).toBe("true");
      expect(first.headers["idempotent-replay"]).toBeUndefined();
      expect(await ep.count()).toBe(before + 1);
    });

    it("creates exactly one record when identical requests arrive at the same time", async () => {
      const k = key();
      const content = text(ep.name);
      const before = await ep.count();

      const responses = await Promise.all(Array.from({ length: 6 }, () => ep.send(k, content)));

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
      const ids = new Set(responses.map((r) => r.body.data.id));
      expect(ids.size).toBe(1);
      expect(await ep.count()).toBe(before + 1);
    });

    it("answers 409 when the key is reused with a different payload, and creates nothing", async () => {
      const k = key();
      const before = await ep.count();
      expect((await ep.send(k, text(ep.name))).status).toBe(201);

      const reused = await ep.send(k, text(`${ep.name} changed`));

      expect(reused.status).toBe(409);
      expect(reused.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      expect(await ep.count()).toBe(before + 1);
    });

    it("keeps behaving as before without a key: every request creates a record", async () => {
      const before = await ep.count();
      const content = text(ep.name);
      const a = await ep.send(null, content);
      const b = await ep.send(null, content);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body.data.id).not.toBe(b.body.data.id);
      expect(await ep.count()).toBe(before + 2);
      expect(a.headers["idempotent-replay"]).toBeUndefined();
    });

    it.each([["too short", "abc"], ["too long", "k".repeat(129)], ["illegal characters", "bad key with spaces!"]])(
      "rejects a key that is %s with 400 and creates nothing",
      async (_label, badKey) => {
        const before = await ep.count();
        const res = await ep.send(badKey, text(ep.name));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(await ep.count()).toBe(before);
      }
    );

    it("stores a response per user: the same key from another user is not a replay", async () => {
      if (ep.name === "internal note") return; // only IT staff may write notes
      const k = key();
      const content = text(ep.name);
      const mine = await ep.send(k, content);
      // A second requester cannot comment on this ticket, but can create their own ticket with the same key.
      if (ep.name === "ticket") {
        const theirs = await ep.send(k, content, cookies.otherRequester);
        expect(theirs.status).toBe(201);
        expect(theirs.body.data.id).not.toBe(mine.body.data.id);
      } else {
        const theirs = await ep.send(k, content, cookies.staff);
        expect(theirs.status).toBe(201);
        expect(theirs.body.data.id).not.toBe(mine.body.data.id);
      }
    });

    it("treats an expired record as new: the same key creates again after the 24-hour window", async () => {
      const k = key();
      const content = text(ep.name);
      const before = await ep.count();
      const first = await ep.send(k, content);
      expect(first.status).toBe(201);

      await prisma.requestIdempotency.updateMany({ where: { key: k }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const again = await ep.send(k, content);

      expect(again.status).toBe(201);
      expect(again.headers["idempotent-replay"]).toBeUndefined();
      expect(again.body.data.id).not.toBe(first.body.data.id);
      expect(await ep.count()).toBe(before + 2);
      expect(await prisma.requestIdempotency.count({ where: { key: k } })).toBe(1);
    });
  });

  describe("failures are not remembered", () => {
    it("lets a corrected request reuse the key after a validation error", async () => {
      const k = key();
      const invalid = await postTicket(k, "bad"); // summary too short
      expect(invalid.status).toBe(400);
      expect(await prisma.requestIdempotency.count({ where: { key: k } })).toBe(0);

      const corrected = await postTicket(k, text("corrected"));
      expect(corrected.status).toBe(201);
    });

    it("does not record anything for a comment on a ticket the requester cannot see", async () => {
      const k = key();
      const res = await withKey(request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", cookies.otherRequester), k).send({ content: text("hidden") });
      expect(res.status).toBe(404);
      expect(await prisma.requestIdempotency.count({ where: { key: k } })).toBe(0);
    });
  });

  describe("ticket attachments on a retry", () => {
    const pdf = (body: string) => Buffer.from(`%PDF-1.4\n${body}\n`);
    const postWithFile = (k: string, summary: string, fileBody: string) =>
      postTicket(k, summary).attach("attachments", pdf(fileBody), { filename: "evidence.pdf", contentType: "application/pdf" });

    it("creates one attachment record and leaves no duplicate file on disk when the upload is retried", async () => {
      const k = key();
      const summary = text("with file");
      const first = await postWithFile(k, summary, "same content");
      expect(first.status).toBe(201);
      expect(first.body.data.attachments).toHaveLength(1);
      const filesAfterFirst = uploadedFileCount();

      const retry = await postWithFile(k, summary, "same content");

      expect(retry.status).toBe(201);
      expect(retry.body).toEqual(first.body);
      expect(await prisma.attachment.count({ where: { ticketId: first.body.data.id } })).toBe(1);
      expect(uploadedFileCount()).toBe(filesAfterFirst); // the retry's upload was discarded
    });

    it("deletes the uploaded file when the key itself is rejected", async () => {
      const filesBefore = uploadedFileCount();
      const res = await postWithFile("bad key!", text("bad key with file"), "orphan check");
      expect(res.status).toBe(400);
      expect(uploadedFileCount()).toBe(filesBefore);
    });

    it("keeps exactly one ticket, one attachment and one file when identical uploads race", async () => {
      const k = key();
      const summary = text("racing upload");
      const filesBefore = uploadedFileCount();

      const responses = await Promise.all(Array.from({ length: 4 }, () => postWithFile(k, summary, "race content")));

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      const ids = new Set(responses.map((r) => r.body.data.id));
      expect(ids.size).toBe(1);
      expect(await prisma.attachment.count({ where: { ticketId: [...ids][0] as number } })).toBe(1);
      expect(uploadedFileCount()).toBe(filesBefore + 1);
    });

    it("treats different file content under the same key as a different request (409) and discards its upload", async () => {
      const k = key();
      const summary = text("file changed");
      expect((await postWithFile(k, summary, "original")).status).toBe(201);
      const filesBefore = uploadedFileCount();

      const changed = await postWithFile(k, summary, "tampered");

      expect(changed.status).toBe(409);
      expect(changed.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      expect(uploadedFileCount()).toBe(filesBefore);
    });
  });
});
