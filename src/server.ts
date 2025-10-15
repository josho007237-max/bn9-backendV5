import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { Client, middleware as lineMiddleware, type Message, type TextMessage, type FlexMessage } from "@line/bot-sdk";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8080);
const DASHBOARD_KEY = process.env.DASHBOARD_API_KEY!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// ตรวจสอบว่า LINE Token พร้อมไหม
const hasLINE = CHANNEL_ACCESS_TOKEN && CHANNEL_SECRET;
if (!hasLINE) {
  console.warn("⚠️ LINE creds not found. Running in MOCK mode (no real push).");
}

// สร้าง LINE Client (หรือ mock ถ้าไม่มี Token)
export const lineClient = hasLINE
  ? new Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN! })
  : ({
      pushMessage: async (to: string, messages: any) => {
        console.log("[MOCK] pushMessage →", to);
        console.log("[MOCK] messages:", JSON.stringify(messages, null, 2));
      },
    } as unknown as Client);

// LINE webhook middleware (ใช้จริงถ้ามี secret)
export const lineWebhookMiddleware = hasLINE
  ? lineMiddleware({
      channelAccessToken: CHANNEL_ACCESS_TOKEN!,
      channelSecret: CHANNEL_SECRET!,
    })
  : ((req, res, next) => {
      console.log("[MOCK] LINE webhook middleware");
      next();
    }) as any;

// CORS (อนุญาตเฉพาะโดเมน frontend)
app.use(
  cors({
    origin: process.env.ALLOW_ORIGINS?.split(",") || "*",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Logger + JSON body parser
app.use(morgan("tiny"));
app.use(express.json());

// =============== Routes ===============

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ✅ Middleware: ตรวจ Authorization
function requireDashboardAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const auth = req.get("authorization") || "";
  if (auth === `Bearer ${DASHBOARD_KEY}`) return next();
  return res.status(401).send("Unauthorized");
}

// ✅ Push API
app.post("/api/push", requireDashboardAuth, async (req, res) => {
  try {
    const { to, text, flex } = req.body ?? {};
    if (!to) return res.status(400).json({ error: "Missing 'to' (userId/groupId)" });

    const messages: Message[] = [];

    if (flex) {
      const flexMsg: FlexMessage = {
        type: "flex",
        altText: text ?? "BN9 dashboard message",
        contents: flex as any,
      };
      messages.push(flexMsg);
    }

    if (text && !flex) {
      const txtMsg: TextMessage = { type: "text", text };
      messages.push(txtMsg);
    }

    // ส่งข้อความจริง หรือ mock ถ้าไม่มี LINE token
    await lineClient.pushMessage(to, messages.length === 1 ? messages[0] : messages);
    res.json({ ok: true, sent: messages.map((m) => m.type) });
  } catch (e: any) {
    console.error("❌ push error:", e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// ✅ Example: Activity logs
app.get("/api/activity/logs", requireDashboardAuth, (req, res) => {
  res.json({
    activities: [
      { botName: "BN9", platform: "LINE", userId: "Uxxxx", message: "hi", time: new Date().toISOString() },
    ],
  });
});

// ✅ Example: Summarize with AI (mock)
app.post("/api/activity/summarize-ai", requireDashboardAuth, (req, res) => {
  res.json({
    title: "Summary for today",
    summary: "ผู้ใช้ถามเกี่ยวกับโปรโมชั่นและการเติมเงิน",
    insights: ["FAQ เรื่องโปรโมชั่น", "แนะนำเพิ่ม Quick Reply", "ลูกค้ากลับมาทักซ้ำหลายรอบ"],
  });
});

// ✅ LINE Webhook
app.post("/webhook/line", lineWebhookMiddleware, async (req, res) => {
  console.log("[LINE Webhook] Received event:", JSON.stringify(req.body, null, 2));
  res.status(200).end();
});

// =============== Start Server ===============
app.listen(PORT, () => {
  console.log(`✅ BN9 backend running on :${PORT}`);
  if (!hasLINE) console.log("⚠️ Running in MOCK mode (no real push).");
});

