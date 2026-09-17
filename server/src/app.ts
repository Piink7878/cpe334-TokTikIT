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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
    if (!email || !password) {
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

    const categoryId = parseInt(req.body.categoryId, 10);
    const relatedSystemId = parseInt(req.body.relatedSystemId, 10);
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
app.get("/api/tickets/:id", requireAuth, requirePasswordChangeEnforcement, async (req: Request, res: Response): Promise<any> => {
  try {
    const requesterId = req.user!.id;

    const ticketId = parseInt(req.params.id, 10);
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

    const ticketId = parseInt(req.params.id, 10);
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

    const attachmentId = parseInt(req.params.id, 10);
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

    const attachmentId = parseInt(req.params.id, 10);
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
    if (ownerId === "unassigned") {
      where.ownerId = null;
    } else if (ownerId && typeof ownerId === "string") {
      where.ownerId = ownerId;
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
    const ticketId = parseInt(req.params.id, 10);
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

// ---------------------------------------------------------------------------
// PATCH /api/staff/tickets/:id/claim - Claim a ticket
// ---------------------------------------------------------------------------
app.patch("/api/staff/tickets/:id/claim", requireAuth, requirePasswordChangeEnforcement, requireRole(["IT_STAFF", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const newStatus = ticket.currentStatus === "NEW" ? "OPEN" : ticket.currentStatus;

    const updateData: any = {
      ownerId: req.user!.id,
      currentStatus: newStatus
    };

    if (ticket.currentStatus === "NEW") {
      updateData.internalNotes = {
        create: {
          content: "Status changed from NEW to OPEN",
          authorId: req.user!.id
        }
      };
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData
    });

    return res.status(200).json({
      message: "Ticket claimed successfully",
      ticket: updatedTicket
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
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { assigneeId } = req.body;
    if (!assigneeId) {
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

    const newStatus = ticket.currentStatus === "NEW" ? "OPEN" : ticket.currentStatus;

    const updateData: any = {
      ownerId: assigneeId,
      currentStatus: newStatus
    };

    if (ticket.currentStatus === "NEW") {
      updateData.internalNotes = {
        create: {
          content: "Status changed from NEW to OPEN",
          authorId: req.user!.id
        }
      };
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData
    });

    return res.status(200).json({
      message: "Ticket assigned successfully",
      ticket: updatedTicket
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
    const ticketId = parseInt(req.params.id, 10);
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

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { itPriority }
    });

    return res.status(200).json({
      message: "Priority updated successfully",
      ticket: updatedTicket
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
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid ticket ID" } });
    }

    const { status, rejectionReason } = req.body;
    if (!status) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "status is required" } });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }

    const currentStatus = ticket.currentStatus;

    // BR-04: Validate allowed state machine transitions
    // NEW -> OPEN, REJECTED, CANCELLED
    // OPEN -> RESOLVED, CANCELLED
    // RESOLVED -> CLOSED, REOPENED
    // REOPENED -> RESOLVED, CANCELLED
    // Terminal states: CLOSED, REJECTED, CANCELLED

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

    const updateData: any = {
      currentStatus: status
    };

    const noteBody = status === "REJECTED" 
      ? `Status changed from ${currentStatus} to ${status}. Reason: ${rejectionReason.trim()}`
      : `Status changed from ${currentStatus} to ${status}`;

    updateData.internalNotes = {
      create: {
        content: noteBody,
        authorId: req.user!.id
      }
    };

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData
    });

    return res.status(200).json({
      message: "Status updated successfully",
      ticket: updatedTicket
    });
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
    const ticketId = parseInt(req.params.id, 10);
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
    const ticketId = parseInt(req.params.id, 10);
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

    const comment = await prisma.publicComment.create({
      data: {
        ticketId,
        authorId: req.user!.id,
        content: content.trim()
      },
      include: { author: { select: { id: true, fullName: true, role: true } } }
    });

    return res.status(201).json({ data: comment });
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
    const ticketId = parseInt(req.params.id, 10);
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
    const ticketId = parseInt(req.params.id, 10);
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

    const note = await prisma.internalNote.create({
      data: {
        ticketId,
        authorId: req.user!.id,
        content: content.trim()
      },
      include: { author: { select: { id: true, fullName: true, role: true } } }
    });

    return res.status(201).json({ data: note });
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
    const ticketId = parseInt(req.params.id, 10);
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
    if (!name || !email || !role || !password) {
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
          // Lock active admin rows to prevent concurrent deactivations (Race Condition BR-17)
          const activeAdmins: any[] = await tx.$queryRaw`
            SELECT id FROM "User" WHERE "role" = 'ADMIN'::"Role" AND "isActive" = true FOR UPDATE
          `;
          if (activeAdmins.length <= 1) {
            throw new Error("VALIDATION_ERROR:Cannot deactivate the last active Admin");
          }
        }
      }

      if (role && role !== "ADMIN" && user.role === "ADMIN" && user.isActive) {
          // Lock active admin rows to prevent concurrent role changes
          const activeAdmins: any[] = await tx.$queryRaw`
            SELECT id FROM "User" WHERE "role" = 'ADMIN'::"Role" AND "isActive" = true FOR UPDATE
          `;
          if (activeAdmins.length <= 1) {
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
    if (error.message.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: error.message.split(":")[1] } });
    }
    if (error.message.startsWith("CONFLICT:")) {
      return res.status(409).json({ error: { code: "CONFLICT", message: error.message.split(":")[1] } });
    }
    if (error.message.startsWith("VALIDATION_ERROR:")) {
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
    if (!newPassword) {
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

export default app;
