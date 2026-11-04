import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app";
import { getPrisma } from "../../src/prisma";

const prisma = getPrisma();

// Values a client could send in place of the expected type. None of them may crash a handler (HTTP 5xx).
const HOSTILE_VALUES: [string, unknown][] = [
  ["object", { a: 1 }],
  ["array", [1, 2]],
  ["number", 12345],
  ["boolean", true],
  ["null", null],
  ["very long string", "x".repeat(20_000)],
  ["NUL character", "abc\u0000def"]
];

describe("Application hardening (Lab 4 Issue 6)", () => {
  const suffix = Date.now().toString();
  const password = "Password123!";
  let requester: any;
  let staff: any;
  let admin: any;
  let cookies: Record<string, string> = {};
  let ticketId: number;
  let actionId: number;
  const extraUserIds: string[] = [];

  const login = async (email: string) => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    return res.headers["set-cookie"][0] as string;
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    const mk = (role: any, name: string) =>
      prisma.user.create({ data: { email: `${name}_${suffix}@hd.local`, fullName: name, role, passwordHash, isActive: true } });
    requester = await mk("REQUESTER", "hdreq");
    staff = await mk("IT_STAFF", "hdstaff");
    admin = await mk("ADMIN", "hdadmin");
    for (const [key, user] of Object.entries({ requester, staff, admin })) cookies[key] = await login((user as any).email);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `HD-${suffix}`,
        summary: "Hardening ticket",
        description: "Hardening ticket description",
        categoryId: (await prisma.category.findFirst())!.id,
        relatedSystemId: (await prisma.relatedSystem.findFirst())!.id,
        requesterId: requester.id,
        currentStatus: "OPEN",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM"
      }
    });
    ticketId = ticket.id;
    const action = await prisma.actionTaken.create({
      data: { ticketId, performedById: staff.id, description: "Checked", result: "Fine", followUpRequired: false }
    });
    actionId = action.id;
  });

  afterAll(async () => {
    await prisma.idempotencyRecord.deleteMany({ where: { ticketId } });
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
    await prisma.publicComment.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.user.deleteMany({ where: { id: { in: [requester.id, staff.id, admin.id, ...extraUserIds] } } });
  });

  describe("response headers", () => {
    it("sets basic security headers and does not advertise the framework", async () => {
      const res = await request(app).get("/api/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toBe("same-origin");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("CORS", () => {
    it("allows the configured front-end origin with credentials", async () => {
      const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("does not grant other origins credentialed access", async () => {
      const res = await request(app).get("/api/health").set("Origin", "https://evil.example");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("answers a preflight from a foreign origin without CORS grants", async () => {
      const res = await request(app)
        .options("/api/tickets")
        .set("Origin", "https://evil.example")
        .set("Access-Control-Request-Method", "POST");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("safe failures", () => {
    it("answers a malformed JSON body with a JSON 400 and no stack trace", async () => {
      const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"email": "a@b.c", ');
      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Malformed JSON request body");
      expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(js|ts)|node_modules/);
    });

    it("answers an unknown API path with a JSON 404", async () => {
      const res = await request(app).get("/api/does-not-exist");
      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("answers a malformed percent-escape in the path with a JSON 400, and tolerates a raw % in a query string", async () => {
      const bad = await request(app).get("/api/tickets/%E0%A4%A").set("Cookie", cookies.requester);
      expect(bad.status).toBe(400);
      expect(bad.headers["content-type"]).toMatch(/json/);

      const lenient = await request(app).get("/api/tickets?search=100%").set("Cookie", cookies.requester);
      expect(lenient.status).toBe(200);
    });

    it("answers an unsupported request charset with a JSON 4xx", async () => {
      const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json; charset=utf-7").send("{}");
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.headers["content-type"]).toMatch(/json/);
    });

    it("rejects an oversized JSON body with a JSON 413", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "a@b.c", password: "x".repeat(300_000) });
      expect(res.status).toBe(413);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    });
  });

  describe("session handling", () => {
    it("issues a fresh session id at login instead of reusing a pre-login one", async () => {
      const first = await request(app).post("/api/auth/login").send({ email: requester.email, password });
      const cookie = first.headers["set-cookie"][0] as string;
      const second = await request(app).post("/api/auth/login").set("Cookie", cookie).send({ email: requester.email, password });
      const rotated = second.headers["set-cookie"]?.[0] as string | undefined;
      expect(rotated).toBeDefined();
      expect(rotated!.split(";")[0]).not.toBe(cookie.split(";")[0]);
    });

    it.each(HOSTILE_VALUES.filter(([name]) => name !== "very long string" && name !== "NUL character"))(
      "rejects a %s email or password at login with 400 instead of crashing",
      async (_name, value) => {
        for (const body of [{ email: value, password }, { email: requester.email, password: value }]) {
          const res = await request(app).post("/api/auth/login").send(body);
          expect(res.status).toBe(400);
        }
      }
    );
  });

  describe("malformed input never crashes a handler", () => {
    type Probe = { name: string; role: string; method: "post" | "patch" | "put"; path: () => string; body: Record<string, unknown> };
    const probes: Probe[] = [
      { name: "login", role: "", method: "post", path: () => "/api/auth/login", body: { email: "x@y.z", password: "pw" } },
      { name: "change password", role: "requester", method: "post", path: () => "/api/auth/change-password", body: { currentPassword: "wrong", newPassword: "Another123!" } },
      { name: "public comment", role: "requester", method: "post", path: () => `/api/tickets/${ticketId}/comments`, body: { content: "hello" } },
      { name: "internal note", role: "staff", method: "post", path: () => `/api/tickets/${ticketId}/internal-notes`, body: { content: "note" } },
      { name: "assign", role: "staff", method: "patch", path: () => `/api/staff/tickets/${ticketId}/assign`, body: { assigneeId: "x" } },
      { name: "priority", role: "staff", method: "patch", path: () => `/api/staff/tickets/${ticketId}/priority`, body: { itPriority: "HIGH" } },
      { name: "status", role: "staff", method: "patch", path: () => `/api/staff/tickets/${ticketId}/status`, body: { status: "IN_PROGRESS", rejectionReason: "r", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" } },
      {
        name: "create action taken",
        role: "staff",
        method: "post",
        path: () => `/api/tickets/${ticketId}/actions-taken`,
        body: { description: "d", result: "r", followUpRequired: true, followUpNote: "n", attachmentNotes: "a", actionDateTime: "2026-01-01T00:00:00.000Z", assignedToId: "x" }
      },
      {
        name: "update action taken",
        role: "staff",
        method: "patch",
        path: () => `/api/actions-taken/${actionId}`,
        body: { description: "d", result: "r", followUpRequired: true, followUpNote: "n", attachmentNotes: "a", actionDateTime: "2026-01-01T00:00:00.000Z", assignedToId: "x", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" }
      },
      { name: "create user", role: "admin", method: "post", path: () => "/api/admin/users", body: { name: "N", email: "new@hd.local", role: "REQUESTER", password: "Password123!" } },
      { name: "update user", role: "admin", method: "patch", path: () => `/api/admin/users/${requester.id}`, body: { name: "N", email: "hdreq@hd.local", role: "REQUESTER", isActive: true } },
      { name: "reset password", role: "admin", method: "post", path: () => `/api/admin/users/${requester.id}/reset-password`, body: { newPassword: "Password123!" } }
    ];

    const send = (probe: Probe, body: unknown) => {
      let req = request(app)[probe.method](probe.path());
      if (probe.role) req = req.set("Cookie", cookies[probe.role]);
      return req.send(body as object);
    };

    it("answers every wrongly-typed field with a 4xx", async () => {
      const crashes: string[] = [];
      for (const probe of probes) {
        for (const key of Object.keys(probe.body)) {
          for (const [kind, value] of HOSTILE_VALUES) {
            const res = await send(probe, { ...probe.body, [key]: value });
            if (res.status >= 500) crashes.push(`${probe.name}.${key} = ${kind} -> ${res.status}`);
          }
        }
        for (const body of [{}, [], "text", null]) {
          const res = await send(probe, body);
          if (res.status >= 500) crashes.push(`${probe.name} body ${JSON.stringify(body)} -> ${res.status}`);
        }
      }
      expect(crashes).toEqual([]);
    });

    it("answers hostile multipart ticket fields with a 4xx and creates nothing", async () => {
      const before = await prisma.ticket.count({ where: { requesterId: requester.id } });
      const valid = { categoryId: "1", relatedSystemId: "1", requestedPriority: "HIGH", summary: "Summary text", description: "Description text" };
      const crashes: string[] = [];
      for (const [field, value] of Object.entries({
        categoryId: ["99999999999", "abc", "1e9", " "],
        relatedSystemId: ["99999999999", "abc", " "],
        requestedPriority: ["URGENT", " "],
        summary: ["abc def", "x".repeat(5000)],
        description: ["abc def", "x".repeat(50_000)]
      })) {
        for (const bad of value as string[]) {
          const req = request(app).post("/api/tickets").set("Cookie", cookies.requester);
          for (const [k, v] of Object.entries({ ...valid, [field]: bad })) req.field(k, v);
          const res = await req;
          if (res.status >= 500) crashes.push(`${field} = ${bad.slice(0, 12).replace(" ", "<NUL>")} -> ${res.status}`);
          else if (res.status === 201) crashes.push(`${field} = ${bad.slice(0, 12).replace(" ", "<NUL>")} -> created`);
        }
      }
      expect(crashes).toEqual([]);
      expect(await prisma.ticket.count({ where: { requesterId: requester.id } })).toBe(before);
    });

    it("answers hostile path parameters and query strings with a 4xx", async () => {
      const crashes: string[] = [];
      const check = async (label: string, req: request.Test) => {
        const res = await req;
        if (res.status >= 500) crashes.push(`${label} -> ${res.status}`);
      };
      for (const id of ["abc", "99999999999", "-1", "1.5", "%00"]) {
        await check(`GET ticket ${id}`, request(app).get(`/api/tickets/${id}`).set("Cookie", cookies.requester));
        await check(`GET staff ticket ${id}`, request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.staff));
        await check(`GET actions ${id}`, request(app).get(`/api/tickets/${id}/actions-taken`).set("Cookie", cookies.staff));
        await check(`PATCH status ${id}`, request(app).patch(`/api/staff/tickets/${id}/status`).set("Cookie", cookies.staff).send({ status: "OPEN" }));
        await check(`PATCH action ${id}`, request(app).patch(`/api/actions-taken/${id}`).set("Cookie", cookies.staff).send({ description: "d" }));
        await check(`GET attachment ${id}`, request(app).get(`/api/attachments/${id}/download`).set("Cookie", cookies.requester));
      }
      for (const id of ["not-a-uuid", "%00", "x".repeat(500)]) {
        await check(`PATCH user ${id}`, request(app).patch(`/api/admin/users/${id}`).set("Cookie", cookies.admin).send({ name: "N" }));
        await check(`reset user ${id}`, request(app).post(`/api/admin/users/${id}/reset-password`).set("Cookie", cookies.admin).send({ newPassword: "Password123!" }));
      }
      const queries = [
        "page=99999999999&pageSize=99999999999",
        "page=-5&pageSize=0",
        "page[a]=1&pageSize[]=2",
        "search[a]=1&sortBy[]=x&sortOrder[a]=b",
        "categoryId=99999999999",
        "status[a]=b",
        "categoryId[]=1&requestedPriority[x]=y"
      ];
      for (const q of queries) {
        await check(`GET /api/tickets?${q}`, request(app).get(`/api/tickets?${q}`).set("Cookie", cookies.requester));
        await check(`GET /api/staff/tickets?${q}`, request(app).get(`/api/staff/tickets?${q}`).set("Cookie", cookies.staff));
        await check(`GET /api/admin/users?${q}`, request(app).get(`/api/admin/users?${q}`).set("Cookie", cookies.admin));
      }
      expect(crashes).toEqual([]);
    });
  });
});
