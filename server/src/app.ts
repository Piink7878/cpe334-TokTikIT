import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { upload } from "./middlewares/upload.js";
import fs from "fs";
import path from "path";
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

// ---------------------------------------------------------------------------
// GET /api/tickets - List Requester Tickets (My Tickets)
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterIdHeader = req.headers["x-requester-id"];
    if (!requesterIdHeader) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing X-Requester-Id header" } });
    }
    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (isNaN(requesterId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid X-Requester-Id header" } });
    }

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
      const parsedCategoryId = parseInt(categoryId as string, 10);
      if (!isNaN(parsedCategoryId)) {
        where.categoryId = parsedCategoryId;
      }
    }
    if (requestedPriority && typeof requestedPriority === "string") {
      where.requestedPriority = requestedPriority;
    }
    if (itPriority && typeof itPriority === "string") {
      where.itPriority = itPriority;
    }
    if (status && typeof status === "string") {
      where.currentStatus = status;
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
app.get("/api/tickets/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterIdHeader = req.headers["x-requester-id"];
    if (!requesterIdHeader) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing X-Requester-Id header" } });
    }
    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (isNaN(requesterId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid X-Requester-Id header" } });
    }

    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
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
      requester: ticket.requester,
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
app.post("/api/tickets/:id/attachments", (req, res, next) => {
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
    const requesterIdHeader = req.headers["x-requester-id"];
    if (!requesterIdHeader) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing X-Requester-Id header" } });
    }
    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (isNaN(requesterId)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid X-Requester-Id header" } });
    }

    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "File is required" } });
    }

    const prisma = getPrisma();
    
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
app.get("/api/attachments/:id/download", async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterIdHeader = req.headers["x-requester-id"];
    if (!requesterIdHeader) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing X-Requester-Id header" } });
    }
    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (isNaN(requesterId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid X-Requester-Id header" } });
    }

    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid attachment ID" } });
    }

    const prisma = getPrisma();
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
app.delete("/api/attachments/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterIdHeader = req.headers["x-requester-id"];
    if (!requesterIdHeader) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing X-Requester-Id header" } });
    }
    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (isNaN(requesterId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid X-Requester-Id header" } });
    }

    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid attachment ID" } });
    }

    const removalReason = req.body.removalReason?.trim();
    if (!removalReason || removalReason.length < 5 || removalReason.length > 255) {
      return res.status(400).json({ error: { code: "MISSING_REMOVAL_REASON", message: "A non-empty removal reason is required to remove an attachment." } });
    }

    const prisma = getPrisma();
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

export default app;
