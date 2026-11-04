import crypto from "crypto";
import express, { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { upload } from "./middlewares/upload.js";
import fs from "fs";
import path from "path";
import session from "express-session";
import bcrypt from "bcryptjs";
import { requireAuth, requirePasswordChangeEnforcement, requireRole } from "./middlewares/auth.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.
void getPrisma;

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.disable("x-powered-by");

// The browser app is served from the Vite dev server (proxying /api); only configured origins may make credentialed
// cross-origin requests. Requests without an Origin header (same-origin, curl, tests) are unaffected.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set when NODE_ENV=production");
}

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
app.use(express.json());

// PostgreSQL text columns cannot hold NUL characters; reject them up front instead of failing inside a query.
const containsNullByte = (value: unknown): boolean => {
  if (typeof value === "string") return value.includes("\u0000");
  if (Array.isArray(value)) return value.some(containsNullByte);
  if (value && typeof value === "object") return Object.entries(value).some(([k, v]) => containsNullByte(k) || containsNullByte(v));
  return false;
};
app.use((req, res, next) => {
  // An undecodable URL is left to Express (it answers path-parameter decoding failures with a 400 handled below).
  let url = req.originalUrl;
  try {
    url = decodeURIComponent(url);
  } catch {
    /* keep the raw URL */
  }
  if (containsNullByte(url) || /%00/i.test(req.originalUrl) || containsNullByte(req.body) || containsNullByte(req.query)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request contains an invalid character" } });
  }
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || "default_secret_for_local_dev",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 2 * 60 * 60 * 1000 // 2 hours of inactivity
  }
}));

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
app.post("/api/auth/login", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required" } });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } });
    }

    // A new session id at login prevents session fixation (a pre-login id never becomes an authenticated one).
    await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.userId = user.id;
    req.session.establishedAt = Date.now();
    
    return res.status(200).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
app.post("/api/auth/logout", requireAuth, (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: { message: "Failed to logout" } });
    }
    res.clearCookie("connect.sid");
    return res.status(200).json({ message: "Logged out successfully" });
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
  }
  return res.status(200).json({
    user: {
      id: req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      mustChangePassword: req.user.mustChangePassword
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------
app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Current password, new password, and confirm password are required" } });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "New password and confirm password must match" } });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid current password" } });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character." } });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false
      }
    });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/related-systems
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json({ data: relatedSystems });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch related systems" });
  }
});


// ---------------------------------------------------------------------------
// POST /api/tickets
// ---------------------------------------------------------------------------
app.post("/api/tickets", requireAuth, requirePasswordChangeEnforcement, (req, res, next) => {
  upload.array("attachments", 5)(req, res, (err: any) => {
    if (err) {
      if (err.message === "INVALID_FILE_TYPE") {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid file type" } });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: { code: "FILE_TOO_LARGE", message: "Attachment file size exceeds the 5MB limit." } });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ error: { code: "ATTACHMENT_LIMIT_EXCEEDED", message: "A ticket cannot have more than 5 active attachments." } });
      }
      return res.status(400).json({ error: { code: "UPLOAD_ERROR", message: err.message } });
    }
    next();
  });
}, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const categoryId = parseId(req.body.categoryId);
    const relatedSystemId = parseId(req.body.relatedSystemId);
    const summary = req.body.summary?.trim();
    const description = req.body.description?.trim();
    const requestedPriority = req.body.requestedPriority;
    const details: any[] = [];
    if (!summary || summary.length < 5 || summary.length > 150) {
      details.push({ field: "summary", message: "Summary must be between 5 and 150 characters." });
    }
    if (!description || description.length < 10 || description.length > 3000) {
      details.push({ field: "description", message: "Description must be between 10 and 3000 characters." });
    }
    if (isNaN(categoryId)) {
      details.push({ field: "categoryId", message: "Invalid Category ID" });
    }
    if (isNaN(relatedSystemId)) {
      details.push({ field: "relatedSystemId", message: "Invalid Related System ID" });
    }
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (!validPriorities.includes(requestedPriority)) {
      details.push({ field: "requestedPriority", message: "Invalid Requested Priority" });
    }

    if (details.length > 0) {
      discardUploadedFiles(req);
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed", details } });
    }

    const prisma = getPrisma();

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Category not found or inactive" } });
    }
    const relatedSystem = await prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } });
    if (!relatedSystem || !relatedSystem.isActive) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Related system not found or inactive" } });
    }

    const currentYear = new Date().getFullYear();
    const attachmentsData: { originalName: string; storedName: string; mimeType: string; sizeBytes: number }[] = [];
    if (req.files) {
      for (const file of req.files as Express.Multer.File[]) {
        attachmentsData.push({
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size
        });
      }
    }

    // Optional replay protection: the payload includes the uploaded files' content so a retry must match exactly.
    let idem: IdempotencyStart = { kind: "none" };
    if (req.headers["idempotency-key"] !== undefined) {
      const uploaded = (req.files as Express.Multer.File[] | undefined) ?? [];
      const files = await Promise.all(
        uploaded.map(async (f) => ({
          name: f.originalname,
          type: f.mimetype,
          size: f.size,
          sha256: crypto.createHash("sha256").update(await fs.promises.readFile(f.path)).digest("hex")
        }))
      );
      idem = await beginIdempotent(req, res, "POST /api/tickets", { categoryId, relatedSystemId, requestedPriority, summary, description, files }, () => discardUploadedFiles(req));
      if (idem.kind === "handled") return;
    }

    let maxRetries = 5;
    let ticket: any = null;
    let storedBody: unknown = null;

    while (maxRetries > 0) {
      const create = async (db: Prisma.TransactionClient) => {
        const lastTicket = await db.ticket.findFirst({
          where: { ticketNumber: { startsWith: `TKT-${currentYear}-` } },
          orderBy: { ticketNumber: "desc" }
        });

        let sequence = 1;
        if (lastTicket) {
          const parts = lastTicket.ticketNumber.split('-');
          sequence = parseInt(parts[2], 10) + 1;
        }
        const ticketNumber = `TKT-${currentYear}-${String(sequence).padStart(6, '0')}`;

        return db.ticket.create({
          data: {
            ticketNumber,
            requesterId,
            categoryId,
            relatedSystemId,
            summary,
            description,
            requestedPriority,
            itPriority: requestedPriority,
            currentStatus: "NEW",
            attachments: {
              create: attachmentsData
            }
          },
          include: { attachments: true }
        });
      };

      try {
        if (idem.kind === "new") {
          // The ticket and its stored response commit together (see createWithIdempotency).
          ticket = await prisma.$transaction(async (tx) => {
            const created = await create(tx);
            storedBody = { data: formatTicket(created) };
            await recordIdempotent(tx, req, idem.ctx, 201, storedBody);
            return created;
          });
        } else {
          ticket = await create(prisma as unknown as Prisma.TransactionClient);
        }
        break; // Successfully created
      } catch (err: any) {
        if (isIdempotencyConflict(err) && idem.kind === "new") {
          // An identical request committed first: answer with its stored response and keep no files of ours.
          if (await replayIfRecorded(req, res, idem.ctx, () => discardUploadedFiles(req))) return;
          throw err;
        }
        if (err.code === "P2002") {
          maxRetries--;
          if (maxRetries === 0) {
            throw new Error("Concurrency collision on ticket number generation. Max retries exceeded.");
          }
          // Loop will retry
        } else {
          throw err; // Rethrow other database errors
        }
      }
    }

    const formattedTicket = formatTicket(ticket);

    return res.status(201).json({ data: formattedTicket });

  } catch (error: any) {
    discardUploadedFiles(req);
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets - List Requester Tickets (My Tickets)
// ---------------------------------------------------------------------------
// Integer ids must fit the database's 32-bit integer column; anything larger is treated like a non-numeric id.
function parseId(raw: unknown): number {
  const n = parseInt(String(raw), 10);
  return Number.isInteger(n) && Math.abs(n) <= 2147483647 ? n : NaN;
}

// ---------------------------------------------------------------------------
// Replay protection for creating tickets, public comments and internal notes (safe network retries).
// A request that carries an Idempotency-Key is recorded together with its response; a retry with the same key and
// payload (for example after the response was lost to a timeout) gets that stored response and creates nothing.
// Without the header every endpoint behaves exactly as before.
// ---------------------------------------------------------------------------
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

type IdempotencyContext = { key: string; endpoint: string; requestHash: string };
type IdempotencyStart = { kind: "none" } | { kind: "handled" } | { kind: "new"; ctx: IdempotencyContext };

const hashPayload = (payload: unknown) => crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

// Answers the request itself (kind "handled") for an invalid key, a replay, or a key reused with a different payload.
// `cleanup` runs before any such answer is sent (e.g. to delete files the request uploaded).
async function beginIdempotent(req: Request, res: Response, endpoint: string, payload: unknown, cleanup?: () => void): Promise<IdempotencyStart> {
  const raw = req.headers["idempotency-key"];
  const key = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (key === undefined) return { kind: "none" };
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    cleanup?.();
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Idempotency-Key must be 8-128 characters: letters, digits, '.', '_', ':' or '-'" } });
    return { kind: "handled" };
  }
  const ctx = { key, endpoint, requestHash: hashPayload(payload) };
  return (await replayIfRecorded(req, res, ctx, cleanup)) ? { kind: "handled" } : { kind: "new", ctx };
}

async function replayIfRecorded(req: Request, res: Response, ctx: IdempotencyContext, cleanup?: () => void): Promise<boolean> {
  const record = await getPrisma().requestIdempotency.findUnique({
    where: { userId_endpoint_key: { userId: req.user!.id, endpoint: ctx.endpoint, key: ctx.key } }
  });
  if (!record || record.expiresAt <= new Date()) return false;
  cleanup?.();
  if (record.requestHash !== ctx.requestHash) {
    res.status(409).json({ error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "The Idempotency-Key has already been used with a different request payload." } });
    return true;
  }
  res.setHeader("Idempotent-Replay", "true");
  res.status(record.responseStatus).json(record.responseBody);
  return true;
}

// Called inside the same transaction that creates the record, so either both exist or neither does.
async function recordIdempotent(tx: Prisma.TransactionClient, req: Request, ctx: IdempotencyContext, status: number, body: unknown) {
  await tx.requestIdempotency.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await tx.requestIdempotency.create({
    data: {
      userId: req.user!.id,
      endpoint: ctx.endpoint,
      key: ctx.key,
      requestHash: ctx.requestHash,
      responseStatus: status,
      responseBody: body as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
    }
  });
}

// A concurrent request with the same key committed first: its unique record makes this transaction fail.
function isIdempotencyConflict(err: any): boolean {
  if (err?.code !== "P2002") return false;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes("endpoint") : String(target ?? "").includes("RequestIdempotency");
}

// Creates a record through `create` and answers 201. With an idempotency context the record and its stored response
// are committed together, and a lost race against an identical request replays the winner's response.
async function createWithIdempotency(
  req: Request,
  res: Response,
  idem: IdempotencyStart,
  create: (db: Prisma.TransactionClient) => Promise<unknown>
): Promise<any> {
  const prisma = getPrisma();
  if (idem.kind !== "new") {
    return res.status(201).json(await create(prisma as unknown as Prisma.TransactionClient));
  }
  try {
    const body = await prisma.$transaction(async (tx) => {
      const created = await create(tx);
      await recordIdempotent(tx, req, idem.ctx, 201, created);
      return created;
    });
    return res.status(201).json(body);
  } catch (err) {
    if (isIdempotencyConflict(err) && (await replayIfRecorded(req, res, idem.ctx))) return;
    throw err;
  }
}

// Removes files multer already wrote to disk for a request that will not create an attachment record.
// Synchronous, so the files are gone before the response that rejects the request is sent.
function discardUploadedFiles(req: Request) {
  if (!req.files) return;
  for (const file of req.files as Express.Multer.File[]) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* already removed */
    }
  }
}

// Response shape of POST /api/tickets (also what the idempotency record stores for replays).
function formatTicket(ticket: any) {
  return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requesterId: ticket.requesterId,
      categoryId: ticket.categoryId,
      relatedSystemId: ticket.relatedSystemId,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      status: ticket.currentStatus,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachments: ticket.attachments ? ticket.attachments.map((att: {
          id: number;
          originalName: string;
          sizeBytes: number;
          mimeType: string;
          isRemoved: boolean;
          removedAt: Date | null;
          removalReason: string | null;
          createdAt: Date;
      }) => ({
          id: att.id,
          originalFilename: att.originalName,
          fileSize: att.sizeBytes,
          contentType: att.mimeType,
          isRemoved: att.isRemoved,
          removedAt: att.removedAt,
          removedReason: att.removalReason,
          createdAt: att.createdAt
      })) : []
  };
}

const ALL_TICKET_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED", "REJECTED"];
const ALL_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const UNRESOLVED_TICKET_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

// Parses a single value or a comma-separated list (dashboard drill-downs) into a Prisma filter.
// Returns null when any value is not part of the allowed set.
function parseEnumFilter(raw: string, allowed: string[]): string | { in: string[] } | null {
  const values = raw.split(",").map((v) => v.trim());
  if (values.some((v) => !allowed.includes(v))) return null;
  return values.length === 1 ? values[0] : { in: values };
}

app.get("/api/tickets", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const {
      search,
      categoryId,
      requestedPriority,
      itPriority,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      pageSize = "8"
    } = req.query;

    const parsedPage = parseInt(page as string, 10);
    const parsedPageSize = parseInt(pageSize as string, 10);

    if (isNaN(parsedPage) || parsedPage < 1 || isNaN(parsedPageSize) || parsedPageSize < 1) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid pagination parameters" } });
    }

    const where: any = { requesterId };

    if (search && typeof search === "string") {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } }
      ];
    }
    if (categoryId) {
      const parsedCategoryId = parseId(categoryId);
      if (!isNaN(parsedCategoryId)) {
        where.categoryId = parsedCategoryId;
      }
    }
    if (requestedPriority && typeof requestedPriority === "string") {
      const requestedFilter = parseEnumFilter(requestedPriority, ALL_PRIORITIES);
      if (!requestedFilter) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requestedPriority filter" } });
      }
      where.requestedPriority = requestedFilter;
    }
    if (itPriority && typeof itPriority === "string") {
      const priorityFilter = parseEnumFilter(itPriority, ALL_PRIORITIES);
      if (!priorityFilter) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid itPriority filter" } });
      }
      where.itPriority = priorityFilter;
    }
    if (status && typeof status === "string") {
      const statusFilter = parseEnumFilter(status, ALL_TICKET_STATUSES);
      if (!statusFilter) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid status filter" } });
      }
      where.currentStatus = statusFilter;
    }

    const validSortFields = ["ticketNumber", "createdAt", "updatedAt", "summary"];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : "createdAt";
    const orderDirection = sortOrder === "asc" ? "asc" : "desc";

    const skip = (parsedPage - 1) * parsedPageSize;

    const prisma = getPrisma();

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sortField]: orderDirection },
        skip,
        take: parsedPageSize,
        include: {
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } }
        }
      }),
      prisma.ticket.count({ where })
    ]);

    const totalPages = Math.ceil(totalItems / parsedPageSize);

    const formattedData = tickets.map(t => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      category: t.category,
      relatedSystem: t.relatedSystem,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      status: t.currentStatus,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

    return res.status(200).json({
      data: formattedData,
      pagination: {
        page: parsedPage,
        pageSize: parsedPageSize,
        totalItems,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id - Get Ticket Details
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: { code: "FORBIDDEN_ACCESS", message: "You do not have permission to view this ticket." } });
    }

    const formattedTicket = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requester: { id: ticket.requester.id, name: ticket.requester.fullName, email: ticket.requester.email },
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      status: ticket.currentStatus,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachments: ticket.attachments ? ticket.attachments.map(att => ({
        id: att.id,
        originalFilename: att.originalName,
        fileSize: att.sizeBytes,
        contentType: att.mimeType,
        isRemoved: att.isRemoved,
        removedAt: att.removedAt,
        removedReason: att.removalReason,
        createdAt: att.createdAt
      })) : []
    };

    return res.status(200).json({ data: formattedTicket });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/attachments
// ---------------------------------------------------------------------------
app.post("/api/tickets/:id/attachments", requireAuth, requirePasswordChangeEnforcement, (req, res, next) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.message === "INVALID_FILE_TYPE") {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid file type" } });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: { code: "FILE_TOO_LARGE", message: "Attachment file size exceeds the 5MB limit." } });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ error: { code: "ATTACHMENT_LIMIT_EXCEEDED", message: "A ticket cannot have more than 5 active attachments." } });
      }
      return res.status(400).json({ error: { code: "UPLOAD_ERROR", message: err.message } });
    }
    next();
  });
}, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "File is required" } });
    }

    const prisma = getPrisma();
    
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or inactive requester" } });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (ticket.requesterId !== requesterId) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: { code: "FORBIDDEN_ACCESS", message: "You do not have permission to view this ticket." } });
    }

    const activeAttachmentsCount = await prisma.attachment.count({
      where: { ticketId, isRemoved: false }
    });

    if (activeAttachmentsCount >= 5) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { code: "ATTACHMENT_LIMIT_EXCEEDED", message: "A ticket cannot have more than 5 active attachments." } });
    }

    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      }
    });

    return res.status(201).json({
      data: {
        id: attachment.id,
        ticketId: attachment.ticketId,
        originalFilename: attachment.originalName,
        fileSize: attachment.sizeBytes,
        contentType: attachment.mimeType,
        isRemoved: attachment.isRemoved,
        createdAt: attachment.createdAt
      }
    });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/attachments/:id/download
// ---------------------------------------------------------------------------
app.get("/api/attachments/:id/download", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const attachmentId = parseId(req.params.id);
    if (isNaN(attachmentId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid attachment ID" } });
    }

    const prisma = getPrisma();

    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or inactive requester" } });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true }
    });

    if (!attachment) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attachment not found" } });
    }

    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: { code: "FORBIDDEN_ACCESS", message: "You do not have permission to access this attachment." } });
    }

    if (attachment.isRemoved) {
      return res.status(410).json({ error: { code: "ATTACHMENT_REMOVED", message: "This attachment was removed and can no longer be downloaded." } });
    }

    const filePath = path.join(process.cwd(), "uploads", "lab-02", attachment.storedName);
    
    if (!fs.existsSync(filePath)) {
       return res.status(500).json({ error: { message: "File not found on disk" } });
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.download(filePath, attachment.originalName);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/attachments/:id
// ---------------------------------------------------------------------------
app.delete("/api/attachments/:id", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const attachmentId = parseId(req.params.id);
    if (isNaN(attachmentId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid attachment ID" } });
    }

    const removalReason = req.body.removalReason?.trim();
    if (!removalReason || removalReason.length < 5 || removalReason.length > 255) {
      return res.status(400).json({ error: { code: "MISSING_REMOVAL_REASON", message: "A non-empty removal reason is required to remove an attachment." } });
    }

    const prisma = getPrisma();

    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or inactive requester" } });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true }
    });

    if (!attachment) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attachment not found" } });
    }

    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: { code: "FORBIDDEN_ACCESS", message: "You do not have permission to access this attachment." } });
    }

    if (attachment.isRemoved) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Attachment is already removed." } });
    }

    const updatedAttachment = await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        isRemoved: true,
        removedAt: new Date(),
        removalReason
      }
    });

    return res.status(200).json({
      data: {
        id: updatedAttachment.id,
        ticketId: updatedAttachment.ticketId,
        originalFilename: updatedAttachment.originalName,
        isRemoved: updatedAttachment.isRemoved,
        removedAt: updatedAttachment.removedAt,
        removedReason: updatedAttachment.removalReason
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/staff/tickets - IT Staff Ticket Queue
// ---------------------------------------------------------------------------
app.get("/api/staff/tickets", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      search,
      categoryId,
      requestedPriority,
      itPriority,
      status,
      ownerId,
      followUpRequired,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "10"
    } = req.query;

    let parsedPage = parseInt(page as string, 10);
    let parsedLimit = parseInt(limit as string, 10);

    if (isNaN(parsedPage) || parsedPage < 1) {
      parsedPage = 1;
    }
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      parsedLimit = 10;
    }

    const where: any = {};

    if (search && typeof search === "string") {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } }
      ];
    }
    if (categoryId) {
      const parsedCategoryId = parseId(categoryId);
      if (!isNaN(parsedCategoryId)) {
        where.categoryId = parsedCategoryId;
      }
    }
    if (requestedPriority && typeof requestedPriority === "string") {
      const requestedFilter = parseEnumFilter(requestedPriority, ALL_PRIORITIES);
      if (!requestedFilter) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid requestedPriority filter" } });
      }
      where.requestedPriority = requestedFilter;
    }
    if (itPriority && typeof itPriority === "string") {
      const priorityFilter = parseEnumFilter(itPriority, ALL_PRIORITIES);
      if (!priorityFilter) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid itPriority filter" } });
      }
      where.itPriority = priorityFilter;
    }
    if (status && typeof status === "string") {
      const statusFilter = parseEnumFilter(status, ALL_TICKET_STATUSES);
      if (!statusFilter) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid status filter" } });
      }
      where.currentStatus = statusFilter;
    }
    if (ownerId === "unassigned") {
      where.ownerId = null;
    } else if (ownerId === "me") {
      where.ownerId = req.user!.id;
    } else if (ownerId && typeof ownerId === "string") {
      where.ownerId = ownerId;
    }
    if (followUpRequired === "true") {
      where.actionsTaken = { some: { followUpRequired: true } };
    }

    const validSortFields = ["ticketNumber", "createdAt", "updatedAt", "summary", "itPriority", "status"];
    const sortFieldMap: Record<string, string> = {
      ticketNumber: "ticketNumber",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      summary: "summary",
      itPriority: "itPriority",
      status: "currentStatus"
    };
    const sortField = validSortFields.includes(sortBy as string) ? sortFieldMap[sortBy as string] : "createdAt";
    const orderDirection = sortOrder === "asc" ? "asc" : "desc";

    const skip = (parsedPage - 1) * parsedLimit;

    const prisma = getPrisma();

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sortField]: orderDirection },
        skip,
        take: parsedLimit,
        include: {
          category: { select: { id: true, name: true } },
          requester: { select: { id: true, fullName: true } },
          owner: { select: { id: true, fullName: true } }
        }
      }),
      prisma.ticket.count({ where })
    ]);

    const totalPages = Math.ceil(totalItems / parsedLimit);

    const formattedData = tickets.map(t => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      category: t.category,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      status: t.currentStatus,
      requester: {
        id: t.requesterId,
        name: t.requester.fullName
      },
      owner: t.ownerId ? {
        id: t.ownerId,
        name: t.owner!.fullName
      } : null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

    return res.status(200).json({
      data: formattedData,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/staff/assignees - List potential ticket assignees (IT_STAFF, ADMIN)
// ---------------------------------------------------------------------------
app.get("/api/staff/assignees", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["IT_STAFF", "ADMIN"] }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      },
      orderBy: { fullName: "asc" }
    });
    return res.status(200).json({ data: users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/staff/tickets/:id - IT Staff Ticket Detail
// ---------------------------------------------------------------------------
app.get("/api/staff/tickets/:id", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requester: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        attachments: {
          where: { isRemoved: false },
          select: { id: true, originalName: true, sizeBytes: true, mimeType: true, createdAt: true }
        },
        publicComments: {
          include: { author: { select: { id: true, fullName: true, role: true } } },
          orderBy: { createdAt: "asc" }
        },
        internalNotes: {
          include: { author: { select: { id: true, fullName: true, role: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    return res.status(200).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      description: ticket.description,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      status: ticket.currentStatus,
      requester: ticket.requester,
      owner: ticket.owner,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachments: ticket.attachments,
      publicComments: ticket.publicComments,
      internalNotes: ticket.internalNotes
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// BR-08: CLOSED, CANCELLED and REJECTED tickets accept no further status, owner or priority changes.
const TERMINAL_TICKET_STATUSES = ["CLOSED", "CANCELLED", "REJECTED"];

function sendTerminalTicketError(res: Response): Response {
  return res.status(400).json({
    error: { code: "TICKET_TERMINAL", message: "Ticket is in a terminal status and can no longer be modified." }
  });
}

function sendConcurrencyConflict(res: Response): Response {
  return res.status(409).json({
    error: {
      code: "CONCURRENCY_CONFLICT",
      message: "Ticket was modified by another concurrent update. Please reload and retry."
    }
  });
}

// BR-08 / BR-14: the earlier read only decides the response; the write itself must still be conditional, otherwise a
// concurrent request can move the ticket to a terminal status between the check and the update.
async function updateTicketIfUnchanged(
  ticketId: number,
  guard: Prisma.TicketWhereInput,
  data: Prisma.TicketUncheckedUpdateManyInput,
  auditNote?: { content: string; authorId: string }
): Promise<{ ticket: any } | { failure: "TERMINAL" | "CONFLICT" }> {
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({ where: { id: ticketId, ...guard }, data });
    if (updated.count === 0) {
      const current = await tx.ticket.findUnique({ where: { id: ticketId }, select: { currentStatus: true } });
      const terminal = !!current && TERMINAL_TICKET_STATUSES.includes(current.currentStatus);
      return { failure: terminal ? ("TERMINAL" as const) : ("CONFLICT" as const) };
    }
    if (auditNote) {
      await tx.internalNote.create({ data: { ticketId, ...auditNote } });
    }
    return { ticket: await tx.ticket.findUnique({ where: { id: ticketId } }) };
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/staff/tickets/:id/claim - Claim a ticket
// ---------------------------------------------------------------------------
app.patch("/api/staff/tickets/:id/claim", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (TERMINAL_TICKET_STATUSES.includes(ticket.currentStatus)) {
      return sendTerminalTicketError(res);
    }

    const newStatus = ticket.currentStatus === "NEW" ? "OPEN" : ticket.currentStatus;

    const result = await updateTicketIfUnchanged(
      ticketId,
      { currentStatus: ticket.currentStatus },
      { ownerId: req.user!.id, currentStatus: newStatus },
      ticket.currentStatus === "NEW" ? { content: "Status changed from NEW to OPEN", authorId: req.user!.id } : undefined
    );
    if ("failure" in result) {
      return result.failure === "TERMINAL" ? sendTerminalTicketError(res) : sendConcurrencyConflict(res);
    }

    return res.status(200).json({
      message: "Ticket claimed successfully",
      ticket: result.ticket
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/staff/tickets/:id/assign - Assign a ticket
// ---------------------------------------------------------------------------
app.patch("/api/staff/tickets/:id/assign", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { assigneeId } = req.body;
    if (!assigneeId || typeof assigneeId !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "assigneeId is required" } });
    }

    const prisma = getPrisma();
    
    // Validate assignee
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || (assignee.role !== "IT_STAFF" && assignee.role !== "ADMIN") || !assignee.isActive) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid assignee" } });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (TERMINAL_TICKET_STATUSES.includes(ticket.currentStatus)) {
      return sendTerminalTicketError(res);
    }

    const newStatus = ticket.currentStatus === "NEW" ? "OPEN" : ticket.currentStatus;

    const result = await updateTicketIfUnchanged(
      ticketId,
      { currentStatus: ticket.currentStatus },
      { ownerId: assigneeId, currentStatus: newStatus },
      ticket.currentStatus === "NEW" ? { content: "Status changed from NEW to OPEN", authorId: req.user!.id } : undefined
    );
    if ("failure" in result) {
      return result.failure === "TERMINAL" ? sendTerminalTicketError(res) : sendConcurrencyConflict(res);
    }

    return res.status(200).json({
      message: "Ticket assigned successfully",
      ticket: result.ticket
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/staff/tickets/:id/priority - Update IT Priority
// ---------------------------------------------------------------------------
app.patch("/api/staff/tickets/:id/priority", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { itPriority } = req.body;
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (!itPriority || !validPriorities.includes(itPriority)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid or missing itPriority" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (TERMINAL_TICKET_STATUSES.includes(ticket.currentStatus)) {
      return sendTerminalTicketError(res);
    }

    const result = await updateTicketIfUnchanged(
      ticketId,
      { currentStatus: { notIn: TERMINAL_TICKET_STATUSES as any } },
      { itPriority }
    );
    if ("failure" in result) {
      return result.failure === "TERMINAL" ? sendTerminalTicketError(res) : sendConcurrencyConflict(res);
    }

    return res.status(200).json({
      message: "Priority updated successfully",
      ticket: result.ticket
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/staff/tickets/:id/status - Update Ticket Status
// ---------------------------------------------------------------------------
app.patch("/api/staff/tickets/:id/status", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { status, rejectionReason, expectedUpdatedAt } = req.body;
    if (!status) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "status is required" } });
    }

    // Optional stale-update guard (requirements §6.1): the caller's last-seen ticket.updatedAt.
    let expectedDate: Date | undefined;
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null) {
      expectedDate = typeof expectedUpdatedAt === "string" ? new Date(expectedUpdatedAt) : new Date(NaN);
      if (isNaN(expectedDate.getTime())) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "expectedUpdatedAt must be a valid date" } });
      }
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const currentStatus = ticket.currentStatus;

    // A caller working from an outdated view is told so (409) before its transition is judged against newer state.
    if (expectedDate && expectedDate.getTime() !== ticket.updatedAt.getTime()) {
      return sendConcurrencyConflict(res);
    }

    // Approved status transition matrix (specification.md §6.1). Terminal states have no exits (BR-08).
    const allowedTransitions: Record<string, string[]> = {
      NEW: ["OPEN", "REJECTED", "CANCELLED"],
      OPEN: ["RESOLVED", "CANCELLED", "IN_PROGRESS", "WAITING_FOR_REQUESTER"],
      IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "OPEN", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      REOPENED: ["RESOLVED", "CANCELLED", "IN_PROGRESS", "WAITING_FOR_REQUESTER"],
      CLOSED: [],
      REJECTED: [],
      CANCELLED: []
    };

    const permittedNext = allowedTransitions[currentStatus] || [];
    
    if (!permittedNext.includes(status)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: `Invalid transition from ${currentStatus} to ${status}` } });
    }

    // BR-05: Enforce rejection note
    if (status === "REJECTED" && (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim() === "")) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "rejectionReason is required when rejecting a ticket" } });
    }

    const noteBody = status === "REJECTED"
      ? `Status changed from ${currentStatus} to ${status}. Reason: ${rejectionReason.trim()}`
      : `Status changed from ${currentStatus} to ${status}`;

    try {
      const updatedTicket = await prisma.$transaction(async (tx) => {
        // BR-10 Resolution Gate: RESOLVED needs at least one persisted Action Taken (follow-ups do not block).
        if (status === "RESOLVED") {
          const actionsCount = await tx.actionTaken.count({ where: { ticketId } });
          if (actionsCount === 0) {
            throw new Error("ACTION_TAKEN_REQUIRED");
          }
        }

        // BR-14: compare-and-set on the state we validated against, so a competing or stale update loses with 409.
        const updated = await tx.ticket.updateMany({
          where: { id: ticketId, currentStatus, ...(expectedDate ? { updatedAt: expectedDate } : {}) },
          data: { currentStatus: status }
        });
        if (updated.count === 0) {
          throw new Error("CONCURRENCY_CONFLICT");
        }

        await tx.internalNote.create({
          data: { ticketId, authorId: req.user!.id, content: noteBody }
        });

        return tx.ticket.findUnique({ where: { id: ticketId } });
      });

      return res.status(200).json({
        message: "Status updated successfully",
        ticket: updatedTicket
      });
    } catch (err: any) {
      if (err.message === "ACTION_TAKEN_REQUIRED") {
        return res.status(400).json({
          error: { code: "ACTION_TAKEN_REQUIRED", message: "At least one Action Taken is required." }
        });
      }
      if (err.message === "CONCURRENCY_CONFLICT") {
        return sendConcurrencyConflict(res);
      }
      throw err;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id/comments - List public comments
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id/comments", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (req.user!.role === "REQUESTER" && ticket.requesterId !== req.user!.id) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      include: { author: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "asc" }
    });

    return res.status(200).json({ data: comments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/comments - Add public comment
// ---------------------------------------------------------------------------
app.post("/api/tickets/:id/comments", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim() === "") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Comment content is required" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (req.user!.role === "REQUESTER" && ticket.requesterId !== req.user!.id) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const idem = await beginIdempotent(req, res, "POST /api/tickets/:id/comments", { ticketId, content: content.trim() });
    if (idem.kind === "handled") return;

    return createWithIdempotency(req, res, idem, async (db) => {
      const comment = await db.publicComment.create({
        data: {
          ticketId,
          authorId: req.user!.id,
          content: content.trim()
        },
        include: { author: { select: { id: true, fullName: true, role: true } } }
      });
      return { data: comment };
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id/internal-notes - List internal notes
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id/internal-notes", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      include: { author: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "asc" }
    });

    return res.status(200).json({ data: notes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/internal-notes - Add internal note
// ---------------------------------------------------------------------------
app.post("/api/tickets/:id/internal-notes", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim() === "") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Note content is required" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const idem = await beginIdempotent(req, res, "POST /api/tickets/:id/internal-notes", { ticketId, content: content.trim() });
    if (idem.kind === "handled") return;

    return createWithIdempotency(req, res, idem, async (db) => {
      const note = await db.internalNote.create({
        data: {
          ticketId,
          authorId: req.user!.id,
          content: content.trim()
        },
        include: { author: { select: { id: true, fullName: true, role: true } } }
      });
      return { data: note };
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// Actions Taken Endpoints (Lab 4 Part 6)
// ---------------------------------------------------------------------------

// Shared input validation for Action Taken create/update (specification.md BR-04 field limits).
// Returns a human-readable message for the first invalid field, or null when valid.
const ACTION_DATE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function isJsonObject(body: unknown): boolean {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

function validateActionTakenInput(body: any, mode: "create" | "update"): string | null {
  const { description, result, followUpRequired, followUpNote, attachmentNotes, actionDateTime, assignedToId } = body;
  const create = mode === "create";

  if (create || description !== undefined) {
    if (typeof description !== "string" || description.trim() === "") {
      return create ? "description is required" : "description cannot be empty";
    }
    if (description.trim().length < 5 || description.trim().length > 3000) {
      return "description must be between 5 and 3000 characters";
    }
  }

  if (create || result !== undefined) {
    if (typeof result !== "string" || result.trim() === "") {
      return create ? "result is required" : "result cannot be empty";
    }
    if (result.trim().length < 2 || result.trim().length > 1000) {
      return "result must be between 2 and 1000 characters";
    }
  }

  // Optional on create (defaults to false per BR-04); when supplied it must be a boolean.
  if (followUpRequired !== undefined && typeof followUpRequired !== "boolean") {
    return "followUpRequired must be a boolean";
  }

  if (followUpNote !== undefined && followUpNote !== null) {
    if (typeof followUpNote !== "string") return "followUpNote must be a string";
    if (followUpNote.trim().length > 1000) return "followUpNote must be at most 1000 characters";
  }

  if (attachmentNotes !== undefined && attachmentNotes !== null) {
    if (typeof attachmentNotes !== "string") return "attachmentNotes must be a string";
    if (attachmentNotes.trim().length > 1000) return "attachmentNotes must be at most 1000 characters";
  }

  if (assignedToId !== undefined && assignedToId !== null && typeof assignedToId !== "string") {
    return "assignedToId must be a string";
  }

  // On create an omitted/empty actionDateTime defaults to now(); on update it cannot be cleared.
  if (actionDateTime !== undefined && (!create || (actionDateTime !== null && actionDateTime !== ""))) {
    if (typeof actionDateTime !== "string" || isNaN(new Date(actionDateTime).getTime())) {
      return "Invalid actionDateTime";
    }
    if (new Date(actionDateTime).getTime() > Date.now() + ACTION_DATE_FUTURE_TOLERANCE_MS) {
      return "actionDateTime cannot be more than 5 minutes in the future";
    }
  }

  return null;
}

// POST /api/tickets/:id/actions-taken - Record Action Taken
app.post("/api/tickets/:id/actions-taken", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    if (!isJsonObject(req.body)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const {
      description,
      result,
      followUpRequired = false,
      followUpNote,
      attachmentNotes,
      actionDateTime,
      assignedToId
    } = req.body;

    const validationMessage = validateActionTakenInput(req.body, "create");
    if (validationMessage) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: validationMessage } });
    }

    if (followUpRequired && (!followUpNote || followUpNote.trim() === "")) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "followUpNote is required when followUpRequired is true" } });
    }

    const parsedActionDate = actionDateTime ? new Date(actionDateTime) : new Date();

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive) {
        return res.status(400).json({ error: { code: "INACTIVE_ASSIGNEE", message: "Assigned user is inactive." } });
      }
      if (assignee.role !== "IT_STAFF" && assignee.role !== "ADMIN") {
        return res.status(400).json({ error: { code: "INVALID_ASSIGNEE_ROLE", message: "Assignee must have role IT_STAFF or ADMIN." } });
      }
    }

    const rawIdempotencyHeader = req.headers["idempotency-key"];
    const idempotencyKey = (Array.isArray(rawIdempotencyHeader) ? rawIdempotencyHeader[0] : rawIdempotencyHeader)?.trim();

    if (idempotencyKey) {
      const canonicalPayload = JSON.stringify({
        description: description.trim(),
        result: result.trim(),
        followUpRequired,
        followUpNote: followUpRequired ? followUpNote.trim() : null,
        attachmentNotes: attachmentNotes ? attachmentNotes.trim() : null,
        assignedToId: assignedToId || null,
        actionDateTime: actionDateTime ? parsedActionDate.toISOString() : null,
      });
      const requestHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: {
          userId_endpoint_ticketId_key: {
            userId: req.user!.id,
            endpoint: "POST /api/tickets/:id/actions-taken",
            ticketId,
            key: idempotencyKey,
          },
        },
      });

      if (existingRecord) {
        if (existingRecord.expiresAt > new Date()) {
          if (existingRecord.requestHash === requestHash) {
            return res.status(existingRecord.responseStatus).json(existingRecord.responseBody);
          } else {
            return res.status(409).json({
              error: {
                code: "IDEMPOTENCY_KEY_CONFLICT",
                message: "The Idempotency-Key has already been used with a different request payload.",
              },
            });
          }
        }
      }

      try {
        const resultPayload = await prisma.$transaction(async (tx) => {
          await tx.idempotencyRecord.deleteMany({
            where: {
              userId: req.user!.id,
              endpoint: "POST /api/tickets/:id/actions-taken",
              ticketId,
              key: idempotencyKey,
              expiresAt: { lte: new Date() },
            },
          });

          const newAction = await tx.actionTaken.create({
            data: {
              ticketId,
              performedById: req.user!.id,
              assignedToId: assignedToId || null,
              actionDateTime: parsedActionDate,
              description: description.trim(),
              result: result.trim(),
              followUpRequired,
              followUpNote: followUpRequired ? followUpNote.trim() : null,
              attachmentNotes: attachmentNotes ? attachmentNotes.trim() : null,
            },
            include: {
              performedBy: { select: { id: true, fullName: true, role: true } },
              assignedTo: { select: { id: true, fullName: true, role: true } },
            },
          });

          const responsePayload = {
            message: "Action taken recorded successfully",
            data: newAction,
          };

          await tx.idempotencyRecord.create({
            data: {
              userId: req.user!.id,
              endpoint: "POST /api/tickets/:id/actions-taken",
              ticketId,
              key: idempotencyKey,
              requestHash,
              actionTakenId: newAction.id,
              responseStatus: 201,
              responseBody: responsePayload,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });

          return responsePayload;
        });

        return res.status(201).json(resultPayload);
      } catch (err: any) {
        if (err.code === "P2002") {
          const committedRecord = await prisma.idempotencyRecord.findUnique({
            where: {
              userId_endpoint_ticketId_key: {
                userId: req.user!.id,
                endpoint: "POST /api/tickets/:id/actions-taken",
                ticketId,
                key: idempotencyKey,
              },
            },
          });
          if (committedRecord && committedRecord.requestHash === requestHash) {
            return res.status(committedRecord.responseStatus).json(committedRecord.responseBody);
          } else {
            return res.status(409).json({
              error: {
                code: "IDEMPOTENCY_KEY_CONFLICT",
                message: "The Idempotency-Key has already been used with a different request payload.",
              },
            });
          }
        }
        throw err;
      }
    }

    // No idempotency key provided
    const newAction = await prisma.actionTaken.create({
      data: {
        ticketId,
        performedById: req.user!.id,
        assignedToId: assignedToId || null,
        actionDateTime: parsedActionDate,
        description: description.trim(),
        result: result.trim(),
        followUpRequired,
        followUpNote: followUpRequired ? followUpNote.trim() : null,
        attachmentNotes: attachmentNotes ? attachmentNotes.trim() : null,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, role: true } },
      },
    });

    return res.status(201).json({
      message: "Action taken recorded successfully",
      data: newAction,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// PATCH /api/actions-taken/:actionId - Update Action Taken with Optimistic Concurrency and Revision Audit
app.patch("/api/actions-taken/:actionId", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const actionId = parseId(req.params.actionId);
    if (isNaN(actionId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid action ID" } });
    }

    if (!isJsonObject(req.body)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" } });
    }

    const {
      expectedUpdatedAt,
      description,
      result,
      followUpRequired,
      followUpNote,
      attachmentNotes,
      actionDateTime,
      assignedToId
    } = req.body;

    if (!expectedUpdatedAt) {
      return res.status(400).json({ error: { code: "MISSING_EXPECTED_UPDATED_AT", message: "expectedUpdatedAt is required" } });
    }

    const expectedDate = new Date(expectedUpdatedAt);
    if (isNaN(expectedDate.getTime())) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "expectedUpdatedAt must be a valid date" } });
    }

    const prisma = getPrisma();
    const existing = await prisma.actionTaken.findUnique({
      where: { id: actionId },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Action Taken record not found" } });
    }

    const validationMessage = validateActionTakenInput(req.body, "update");
    if (validationMessage) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: validationMessage } });
    }

    const effectiveFollowUpRequired = followUpRequired !== undefined ? followUpRequired : existing.followUpRequired;
    let effectiveFollowUpNote = existing.followUpNote;

    if (effectiveFollowUpRequired) {
      if (followUpNote !== undefined) {
        if (!followUpNote || typeof followUpNote !== "string" || followUpNote.trim() === "") {
          return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "followUpNote is required when followUpRequired is true" } });
        }
        effectiveFollowUpNote = followUpNote.trim();
      } else if (!existing.followUpNote || existing.followUpNote.trim() === "") {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "followUpNote is required when followUpRequired is true" } });
      }
    } else {
      effectiveFollowUpNote = null;
    }

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive) {
        return res.status(400).json({ error: { code: "INACTIVE_ASSIGNEE", message: "Assigned user is inactive." } });
      }
      if (assignee.role !== "IT_STAFF" && assignee.role !== "ADMIN") {
        return res.status(400).json({ error: { code: "INVALID_ASSIGNEE_ROLE", message: "Assignee must have role IT_STAFF or ADMIN." } });
      }
    }

    try {
      const txResult = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.actionTaken.updateMany({
          where: {
            id: actionId,
            updatedAt: expectedDate,
          },
          data: {
            ...(description !== undefined && { description: description.trim() }),
            ...(result !== undefined && { result: result.trim() }),
            ...(followUpRequired !== undefined && { followUpRequired }),
            followUpNote: effectiveFollowUpNote,
            ...(attachmentNotes !== undefined && { attachmentNotes: attachmentNotes ? attachmentNotes.trim() : null }),
            ...(actionDateTime !== undefined && { actionDateTime: new Date(actionDateTime) }),
            ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
          },
        });

        if (updateResult.count === 0) {
          throw new Error("STALE_UPDATE");
        }

        const nextRevisionNumber = (existing.revisions[0]?.revisionNumber || 0) + 1;
        const originalSnapshot = {
          description: existing.description,
          result: existing.result,
          followUpRequired: existing.followUpRequired,
          followUpNote: existing.followUpNote,
          attachmentNotes: existing.attachmentNotes,
          assignedToId: existing.assignedToId,
          actionDateTime: existing.actionDateTime,
        };

        const updatedRecord = await tx.actionTaken.findUnique({
          where: { id: actionId },
          include: {
            performedBy: { select: { id: true, fullName: true, role: true } },
            assignedTo: { select: { id: true, fullName: true, role: true } },
          },
        });

        const updatedSnapshot = {
          description: updatedRecord!.description,
          result: updatedRecord!.result,
          followUpRequired: updatedRecord!.followUpRequired,
          followUpNote: updatedRecord!.followUpNote,
          attachmentNotes: updatedRecord!.attachmentNotes,
          assignedToId: updatedRecord!.assignedToId,
          actionDateTime: updatedRecord!.actionDateTime,
        };

        const newRevision = await tx.actionTakenRevision.create({
          data: {
            actionTakenId: actionId,
            revisionNumber: nextRevisionNumber,
            editedById: req.user!.id,
            originalData: originalSnapshot,
            updatedData: updatedSnapshot,
          },
        });

        return {
          updatedRecord,
          newRevision,
        };
      });

      return res.status(200).json({
        message: "Action taken updated successfully",
        data: {
          ...txResult.updatedRecord,
          latestRevision: {
            revisionNumber: txResult.newRevision.revisionNumber,
            editedById: txResult.newRevision.editedById,
            editedAt: txResult.newRevision.editedAt,
          },
        },
      });
    } catch (err: any) {
      if (err.message === "STALE_UPDATE") {
        const currentRecord = await prisma.actionTaken.findUnique({
          where: { id: actionId },
          include: {
            performedBy: { select: { id: true, fullName: true, role: true } },
            assignedTo: { select: { id: true, fullName: true, role: true } },
          },
        });
        return res.status(409).json({
          error: {
            code: "STALE_UPDATE",
            message: "The record was modified by another user. Please reload and retry.",
          },
          current: currentRecord,
        });
      }
      throw err;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// GET /api/tickets/:id/actions-taken - List Actions Taken
app.get("/api/tickets/:id/actions-taken", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    // Requester authorization & non-enumeration protection
    if (req.user!.role === "REQUESTER" && ticket.requesterId !== req.user!.id) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const sortBy = req.query.sortBy === "createdAt" ? "createdAt" : "actionDateTime";
    const sortOrder = req.query.sortOrder === "desc" ? "desc" : "asc";

    if (req.user!.role === "REQUESTER") {
      // Requesters receive actions without internal revision history snapshots
      const actions = await prisma.actionTaken.findMany({
        where: { ticketId },
        orderBy: { [sortBy]: sortOrder },
        include: {
          performedBy: { select: { id: true, fullName: true, role: true } },
          assignedTo: { select: { id: true, fullName: true, role: true } },
        },
      });

      return res.status(200).json({ data: actions });
    }

    // IT Staff and Admin receive full actions with nested revisions
    const actions = await prisma.actionTaken.findMany({
      where: { ticketId },
      orderBy: { [sortBy]: sortOrder },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, role: true } },
        revisions: {
          orderBy: { revisionNumber: "asc" },
          include: {
            editor: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });

    return res.status(200).json({ data: actions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Explicit DELETE prohibition for Actions Taken (BR-05 / HTTP 405)
app.delete(["/api/actions-taken/:actionId", "/api/tickets/:id/actions-taken/:actionId"], requireAuth, (_req: Request, res: Response) => {
  return res.status(405).json({
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Action Taken records represent legal compliance audit history and cannot be deleted.",
    },
  });
});

// Revision mutation/deletion prohibition (HTTP 405)
app.all(["/api/action-taken-revisions*", "/api/tickets/:id/actions-taken/:actionId/revisions*"], requireAuth, (req: Request, res: Response) => {
  if (req.method === "GET") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  }
  return res.status(405).json({
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Action Taken revisions are immutable and cannot be modified or deleted.",
    },
  });
});

// ---------------------------------------------------------------------------
// Dashboards (FR-13..FR-17, BR-12, BR-13, BR-16)
// All metrics are database aggregates; recent lists are capped at 5.
// ---------------------------------------------------------------------------
const DASHBOARD_RECENT_LIMIT = 5;

// Every status is present in the breakdown, with 0 for statuses that currently have no tickets.
export function buildStatusBreakdown(rows: { currentStatus: string; _count: { _all: number } }[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const status of ALL_TICKET_STATUSES) breakdown[status] = 0;
  for (const row of rows) breakdown[row.currentStatus] = row._count._all;
  return breakdown;
}

// GET /api/dashboard/requester - metrics for the authenticated Requester's own tickets
app.get("/api/dashboard/requester", requireAuth, requirePasswordChangeEnforcement, requireRole(["REQUESTER"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const prisma = getPrisma();
    const requesterId = req.user!.id;

    const [totalTickets, activeTickets, waitingForRequesterTickets, resolvedOrClosedTickets, recent] = await Promise.all([
      prisma.ticket.count({ where: { requesterId } }),
      prisma.ticket.count({ where: { requesterId, currentStatus: { in: ["NEW", "OPEN", "IN_PROGRESS"] } } }),
      prisma.ticket.count({ where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { requesterId, currentStatus: { in: ["RESOLVED", "CLOSED"] } } }),
      prisma.ticket.findMany({
        where: { requesterId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: DASHBOARD_RECENT_LIMIT,
        select: { id: true, ticketNumber: true, summary: true, currentStatus: true, itPriority: true, updatedAt: true }
      })
    ]);

    return res.status(200).json({
      data: {
        totalTickets,
        activeTickets,
        waitingForRequesterTickets,
        resolvedOrClosedTickets,
        recentTickets: recent.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.summary,
          currentStatus: t.currentStatus,
          itPriority: t.itPriority,
          updatedAt: t.updatedAt
        }))
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// GET /api/dashboard/staff - global queue metrics for IT Staff and Administrators
app.get("/api/dashboard/staff", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const prisma = getPrisma();
    const userId = req.user!.id;
    const unresolved = { in: UNRESOLVED_TICKET_STATUSES as any };

    const [
      unassignedTickets,
      myActiveTickets,
      ticketsRequiringFollowUp,
      criticalOrHighPriorityTickets,
      statusCounts,
      recent,
      actions
    ] = await Promise.all([
      prisma.ticket.count({ where: { ownerId: null, currentStatus: { in: ["NEW", "OPEN"] } } }),
      prisma.ticket.count({ where: { ownerId: userId, currentStatus: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] } } }),
      // Counts tickets, not actions: several follow-up actions on one ticket still count once (AC-13).
      prisma.ticket.count({ where: { currentStatus: unresolved, actionsTaken: { some: { followUpRequired: true } } } }),
      prisma.ticket.count({ where: { currentStatus: unresolved, itPriority: { in: ["CRITICAL", "HIGH"] } } }),
      prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
      prisma.ticket.findMany({
        where: { currentStatus: unresolved },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: DASHBOARD_RECENT_LIMIT,
        select: { id: true, ticketNumber: true, summary: true, currentStatus: true, itPriority: true, ownerId: true, updatedAt: true }
      }),
      prisma.actionTaken.findMany({
        where: { OR: [{ performedById: userId }, { assignedToId: userId }] },
        orderBy: [{ actionDateTime: "desc" }, { id: "desc" }],
        take: DASHBOARD_RECENT_LIMIT,
        select: {
          id: true,
          ticketId: true,
          description: true,
          result: true,
          actionDateTime: true,
          followUpRequired: true,
          ticket: { select: { ticketNumber: true } }
        }
      })
    ]);

    return res.status(200).json({
      data: {
        unassignedTickets,
        myActiveTickets,
        ticketsRequiringFollowUp,
        criticalOrHighPriorityTickets,
        statusBreakdown: buildStatusBreakdown(statusCounts),
        recentTickets: recent.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.summary,
          currentStatus: t.currentStatus,
          itPriority: t.itPriority,
          ownerId: t.ownerId,
          updatedAt: t.updatedAt
        })),
        currentUserActions: actions.map((a) => ({
          id: a.id,
          ticketId: a.ticketId,
          ticketNumber: a.ticket.ticketNumber,
          description: a.description,
          result: a.result,
          actionDateTime: a.actionDateTime,
          followUpRequired: a.followUpRequired
        }))
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/indicate-resolved - Problem Appears Resolved
// ---------------------------------------------------------------------------
app.post("/api/tickets/:id/indicate-resolved", requireAuth, requirePasswordChangeEnforcement, requireRole(["REQUESTER"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseId(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    if (req.user!.role === "REQUESTER" && ticket.requesterId !== req.user!.id) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    // Add a public comment
    const comment = await prisma.publicComment.create({
      data: {
        ticketId,
        authorId: req.user!.id,
        content: "The requester has indicated that the problem appears resolved."
      },
      include: { author: { select: { id: true, fullName: true, role: true } } }
    });
    

    return res.status(200).json({ message: "Indicated that the problem is resolved.", data: comment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/users - List users
// ---------------------------------------------------------------------------
app.get("/api/admin/users", requireAuth, requirePasswordChangeEnforcement, requireRole(["ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, role } = req.query;
    const where: any = {};
    if (search && typeof search === "string") {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }
    if (role && typeof role === "string") {
      where.role = role;
    }
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true
      },
      orderBy: { fullName: "asc" }
    });
    return res.status(200).json({ data: users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/users - Create user
// ---------------------------------------------------------------------------
app.post("/api/admin/users", requireAuth, requirePasswordChangeEnforcement, requireRole(["ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password || [name, email, role, password].some((v) => typeof v !== "string")) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Name, email, role, and password are required" } });
    }
    const validRoles = ["REQUESTER", "IT_STAFF", "ADMIN"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid role" } });
    }

    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Email already exists" } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        role,
        passwordHash,
        mustChangePassword: true,
        isActive: true
      }
    });

    return res.status(201).json({
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      requiresPasswordChange: user.mustChangePassword
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// ---------------------------------------------------------------------------
// PUT & PATCH /api/admin/users/:id - Update user
// ---------------------------------------------------------------------------
const updateUserHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id;
    if (!userId) {
       return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "User ID required" }});
    }
    const { name, email, role, isActive } = req.body;
    if (
      [name, email, role].some((v) => v !== undefined && v !== null && typeof v !== "string") ||
      (isActive !== undefined && typeof isActive !== "boolean")
    ) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid field type" } });
    }
    if (role) {
      const validRoles = ["REQUESTER", "IT_STAFF", "ADMIN"];
      if (!validRoles.includes(role)) {
         return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid role" } });
      }
    }
    
    const prisma = getPrisma();

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error("NOT_FOUND:User not found");
      }

      if (email && email !== user.email) {
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) {
          throw new Error("CONFLICT:Email already in use");
        }
      }

      if (isActive === false) {
        if (user.id === req.user!.id) {
          throw new Error("VALIDATION_ERROR:Cannot deactivate your own account");
        }
        if (user.role === "ADMIN") {
          // Use SELECT FOR UPDATE (via subquery) to take a pessimistic write lock
          // on active admin rows, guaranteeing concurrent deactivation attempts
          // genuinely contend at the DB level and produce a P2034 conflict.
          const delayMs = Number(process.env.TEST_CONCURRENCY_DELAY_MS) || 0;
          const result = await tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) AS count
            FROM (
              SELECT id FROM "User"
              WHERE role = 'ADMIN' AND "isActive" = true
              FOR UPDATE
            ) AS locked_admins
          `;
          if (delayMs > 0) {
            await tx.$executeRaw`SELECT pg_sleep(${delayMs / 1000.0})`;
          }
          const activeAdmins = Number(result[0].count);
          if (activeAdmins <= 1) {
            throw new Error("VALIDATION_ERROR:Cannot deactivate the last active Admin");
          }
        }
      }

      if (role && role !== "ADMIN" && user.role === "ADMIN" && user.isActive) {
          const result = await tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) AS count
            FROM (
              SELECT id FROM "User"
              WHERE role = 'ADMIN' AND "isActive" = true
              FOR UPDATE
            ) AS locked_admins
          `;
          const activeAdmins = Number(result[0].count);
          if (activeAdmins <= 1) {
            throw new Error("VALIDATION_ERROR:Cannot remove the ADMIN role from the last active Admin");
          }
      }

      const updateData: any = {};
      if (name) updateData.fullName = name;
      if (email) updateData.email = email;
      if (role) {
        updateData.role = role;
      }
      if (isActive !== undefined) updateData.isActive = isActive;

      return await tx.user.update({
        where: { id: userId },
        data: updateData
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    return res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.fullName,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive
    });

  } catch (error: any) {
    // P2034: Prisma ORM serialization failure (plain tx.user.count approach)
    // P2010 with 40001: PostgreSQL serialization failure via raw query ($queryRaw FOR UPDATE)
    // P2010 with 40P01: PostgreSQL deadlock detected
    const isSerializationError =
      error.code === 'P2034' ||
      (error.code === 'P2010' && (error.meta?.code === '40001' || error.meta?.code === '40P01'));
    if (isSerializationError) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Conflict occurred during update, please try again" } });
    }
    if (error.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: error.message.split(":")[1] } });
    }
    if (error.message?.startsWith("CONFLICT:")) {
      return res.status(409).json({ error: { code: "CONFLICT", message: error.message.split(":")[1] } });
    }
    if (error.message?.startsWith("VALIDATION_ERROR:")) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.message.split(":")[1] } });
    }
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
};
app.put("/api/admin/users/:id", requireAuth, requirePasswordChangeEnforcement, requireRole(["ADMIN"]), updateUserHandler);
app.patch("/api/admin/users/:id", requireAuth, requirePasswordChangeEnforcement, requireRole(["ADMIN"]), updateUserHandler);

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/reset-password - Reset user password
// ---------------------------------------------------------------------------
app.post("/api/admin/users/:id/reset-password", requireAuth, requirePasswordChangeEnforcement, requireRole(["ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "newPassword is required" } });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true
      }
    });

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

// Unknown API paths and body-parser failures answer in JSON like every other API error (no HTML, no stack trace).
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
});

app.use((err: any, _req: Request, res: Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Malformed JSON request body" } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
  }
  // Client errors raised by Express itself (e.g. an undecodable path parameter, an unsupported charset).
  const status = Number(err?.status ?? err?.statusCode);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: { code: "VALIDATION_ERROR", message: "The request could not be processed" } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: "Internal server error" } });
});

export default app;
