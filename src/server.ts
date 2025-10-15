import express, { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { Client, middleware as lineMiddleware, type Message, type TextMessage, type FlexMessage, type FlexContainer } from "@line/bot-sdk";

dotenv.config();

// ---------------------- ENV ----------------------
const PORT = process.env.PORT || 8080;
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY || "super-secret-admin-key";
const ALLOW_ORIGINS = process.env.ALLOW_ORIGINS || "*";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const hasLINE = !!(CHANNEL_ACCESS_TOKEN && CHANNEL_SECRET);

// ---------------------- LINE Client ----------------------
export const lineClient = hasLINE
  ? new Client({
      channelAccessToken: CHANNEL_ACCESS_TOKEN!,
      channelSecret: CHANNEL_SECRET!,
    })
  : ({
      pushMessage: async (to: string, messages: Message[]) => {
        console.log("[MOCK] pushMessage ->", to);
        console.log("[MOCK] messages:", JSON.stringify(messages, null, 2));
      },
    } as unknown as Client);

// ---------------------- EXPRESS APP ----------------------
const app = express();
app.use(cors({ origin: ALLOW_ORIGINS.split(","), credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------- RAW BODY (for LINE signature verify) ----------------------
app.use((req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c as Buffer));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
});

// ---------------------- LINE WEBHOOK ----------------------
export const lineWebhookMiddleware = hasLINE
  ? lineMiddleware({
      channelAccessToken: CHANNEL_ACCESS_TOKEN!,
      channelSecret: CHANNEL_SECRET!,
    })
  : ((req: Request, _res: Response, next: NextFunction) => {
      console.log("[MOCK] LINE webhook middleware");
      next();
    }) as any;

// ---------------------- AUTH CHECK ----------------------
const requireDashboardAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (token !== DASHBOARD_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// ---------------------- ROUTES ----------------------

// Health check
// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// Push message (for Dashboard)
app.post("/api/push", requireDashboardAuth, async (req: Request, res: Response) => {
  try {
    const { to, text, flex } = req.body;

    const messages: Message[] = [];

    if (flex) {
      const flexMsg: FlexMessage = {
        type: "flex",
        altText: text || "BN9 Notification",
        contents: flex as FlexContainer,
      };
      messages.push(flexMsg);
    } else if (text) {
      const textMsg: TextMessage = { type: "text", text };
      messages.push(textMsg);
    }

    await lineClient.pushMessage(to, messages);
    res.json({ success: true, sent: messages });
  } catch (err: any) {
    console.error("Push message error:", err);
    res.status(500).json({ error: "Push message failed", details: err.message });
  }
});

// LINE webhook receiver
app.post("/webhook", lineWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const events = req.body?.events || [];
    console.log(`[Webhook] Received ${events.length} events`);
    for (const ev of events) {
      if (ev.type === "message" && ev.message.type === "text") {
        const replyToken = ev.replyToken;
        const text = ev.message.text;
        const reply: TextMessage = { type: "text", text: `พี่พลอยได้รับข้อความ "${text}" แล้วนะคะ 💖` };
        await lineClient.replyMessage(replyToken, [reply]);
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => {
  console.log(`BN9 backend running on :${PORT}`);
});

