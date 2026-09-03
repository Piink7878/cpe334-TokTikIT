import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "lab-02");

// Ensure directory exists synchronously
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uuid = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uuid}${ext}`);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_FILE_TYPE"));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5242880, // 5 MB
    files: 5, // max 5 files
  },
  fileFilter
});
