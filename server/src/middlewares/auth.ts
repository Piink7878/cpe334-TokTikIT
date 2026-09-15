import { Request, Response, NextFunction } from "express";
import { getPrisma } from "../prisma.js";

// Ensure typings are loaded


export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } }); // generic safe error as requested or just Unauthorized
  }

  // 24h absolute expiration
  if (req.session.establishedAt && Date.now() - req.session.establishedAt > 24 * 60 * 60 * 1000) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session expired" } });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
};

export const requirePasswordChangeEnforcement = (req: Request, res: Response, next: NextFunction): any => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: { code: "PASSWORD_CHANGE_REQUIRED", message: "You must change your password before accessing this resource." } });
  }
  next();
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Forbidden" } });
    }
    next();
  };
};
