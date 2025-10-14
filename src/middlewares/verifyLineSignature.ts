import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
export function verifyLineSignature(channelSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.get("x-line-signature");
    if (!signature) return res.status(401).send("Missing LINE signature");
    const body = (req as any).rawBody as Buffer;
    const hash = crypto.createHmac("sha256", channelSecret).update(body).digest("base64");
    if (hash !== signature) return res.status(401).send("Invalid signature");
    next();
  };
}
