import { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-admin-key"] || req.query.adminKey) as string | undefined;
  if (!process.env.ADMIN_TOKEN || !token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}