// ✅ src/server.ts

// src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { lineClient, lineWebhookMiddleware } from "./services/lineClient.js";

dotenv.config();

const app = express();

// ❗ ห้าม parse JSON ก่อน /webhook
app.use(cors());
app.use(morgan("dev"));

// --- LINE Webhook ต้องมาก่อน express.json() ---
app.post("/webhook", lineWebhookMiddleware, (_req, res) => {
  // ถึงจุดนี้ signature ผ่านแล้ว
  res.status(200).send("OK");
});

// ค่อย parse JSON ให้ route อื่น ๆ
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Push API
app.post("/api/push", async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) {
    return res.status(400).json({ ok: false, error: "Missing 'to' or 'text'" });
  }
  try {
    await lineClient.pushMessage(to, { type: "text", text });
    res.json({ ok: true, message: "Message sent successfully!" });
  } catch (err: any) {
    console.error("LINE push error:", err?.message || err);
    res.status(500).json({ ok: false, error: err?.message || "push failed" });
  }
});

// กันพังเฉพาะกรณี webhook (ไม่ให้ LINE เห็น 500)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  if (req.path === "/webhook") return res.status(200).send("OK");
  return res.status(500).json({ ok: false, error: "internal error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`BN9 backend running on :${PORT}`);
});

