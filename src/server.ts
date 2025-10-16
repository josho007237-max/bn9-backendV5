// ✅ src/server.ts

import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { lineClient, lineWebhookMiddleware } from "./services/lineClient.js"; // 👈 ต้องมี .js

dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ✅ LINE webhook endpoint
app.post("/webhook", lineWebhookMiddleware, (req, res) => {
  res.json({ ok: true });
});

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// ✅ Push message endpoint (สำหรับทดสอบยิงข้อความ)
app.post("/api/push", async (req, res) => {
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({
      ok: false,
      error: "Missing 'to' or 'text'",
    });
  }

  try {
    await lineClient.pushMessage(to, { type: "text", text });
    res.json({ ok: true, message: "Message sent successfully!" });
  } catch (error: any) {
    console.error("LINE push error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`BN9 backend running on :${PORT}`);
});

