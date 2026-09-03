import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { upload } from "./middlewares/upload.js";
import fs from "fs";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.
void getPrisma;

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

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
// Issue 3 — Requesters list
// Add:  GET /api/requesters
//   -> read active requesters from PostgreSQL via getPrisma().developmentRequester.findMany(...)
//   -> return { data: [...] }
//   -> on failure, respond 500 with a safe message
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.developmentRequester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" }
    });
    res.status(200).json({ data: requesters });
  } catch (error) {
    res.status(500).json({ error: { message: "Failed to fetch requesters" } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets
// ---------------------------------------------------------------------------
app.post("/api/tickets", (req, res, next) => {
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
    const requesterIdHeader = req.headers["x-requester-id"];
    if (!requesterIdHeader) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing X-Requester-Id header" } });
    }
    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (isNaN(requesterId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid X-Requester-Id header" } });
    }

    const categoryId = parseInt(req.body.categoryId, 10);
    const relatedSystemId = parseInt(req.body.relatedSystemId, 10);
    const summary = req.body.summary?.trim();
    const description = req.body.description?.trim();
    const requestedPriority = req.body.requestedPriority;
    const bodyRequesterId = req.body.requesterId ? parseInt(req.body.requesterId, 10) : undefined;

    const details = [];
    if (bodyRequesterId && bodyRequesterId !== requesterId) {
       details.push({ field: "requesterId", message: "Requester ID mismatch" });
    }
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
      if (req.files) {
        for (const file of req.files as Express.Multer.File[]) {
          fs.unlink(file.path, () => {});
        }
      }
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
    const attachmentsData = [];
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

    let maxRetries = 5;
    let ticket: any = null;

    while (maxRetries > 0) {
      const lastTicket = await prisma.ticket.findFirst({
        where: { ticketNumber: { startsWith: `TKT-${currentYear}-` } },
        orderBy: { ticketNumber: "desc" }
      });

      let sequence = 1;
      if (lastTicket) {
        const parts = lastTicket.ticketNumber.split('-');
        sequence = parseInt(parts[2], 10) + 1;
      }
      const ticketNumber = `TKT-${currentYear}-${String(sequence).padStart(6, '0')}`;

      try {
        ticket = await prisma.ticket.create({
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
        break; // Successfully created
      } catch (err: any) {
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

    const formattedTicket = {
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

    return res.status(201).json({ data: formattedTicket });

  } catch (error: any) {
    if (req.files) {
      for (const file of req.files as Express.Multer.File[]) {
        fs.unlink(file.path, () => {});
      }
    }
    console.error(error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
});

export default app;
