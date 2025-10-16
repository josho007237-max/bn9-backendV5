// src/services/lineClient.ts
import crypto from "crypto";
import { classifyAndRespond } from "./gpt";
import { appendLog, findLastByUserId } from "./sheets";
import { shouldAlert, sendAlertMessage } from "./notify";

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || "";

export async function pushText(to: string, text: string) {
  if (!LINE_TOKEN) {
    console.log("[LINE MOCK] push", to, text);
    return;
  }
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });
  if (!r.ok) {
    console.error("LINE push error:", await r.text());
  }
}

export async function replyText(replyToken: string, text: string) {
  if (!LINE_TOKEN) {
    console.log("[LINE MOCK] reply", text);
    return;
  }
  const r = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!r.ok) {
    console.error("LINE reply error:", await r.text());
  }
}

export function lineWebhookMiddleware(req: any, res: any, next: any) {
  if (!LINE_SECRET) return next();
  try {
    const sig = req.get("x-line-signature") || "";
    const raw = req.rawBody || Buffer.from("");
    const hmac = crypto.createHmac("sha256", LINE_SECRET).update(raw).digest("base64");
    if (sig !== hmac) return res.status(401).send("Bad signature");
    next();
  } catch (e) {
    console.error("signature check:", e);
    res.status(401).send("Bad signature");
  }
}

export async function handleWebhookEvent(ev: any) {
  if (ev.type !== "message" || ev.message?.type !== "text") return;

  const userId: string = ev.source?.userId || "";
  const text: string = ev.message?.text || "";
  const replyToken: string = ev.replyToken || "";

  const last = userId ? await findLastByUserId(userId) : null;
  const returning = !!last;

  const gpt = await classifyAndRespond(text);
  const ts = new Date().toISOString();

  await appendLog(gpt.category, [ts, userId, text, gpt.category, gpt.reason, gpt.reply]);

  if (shouldAlert(gpt.category)) {
    const alertMsg = [
      "🚨 เคสใหม่จากลูกค้า BN9",
      `หมวด: ${gpt.category}`,
      `userId: ${userId || "-"}`,
      `ข้อความ: ${text}`,
      `สรุป: ${gpt.reason}`,
      returning ? "🟡 ลูกค้าเก่า" : "🟢 ลูกค้าใหม่",
    ].join("\n");
    await sendAlertMessage(alertMsg);
  }

  const reply = (returning ? "ยินดีต้อนรับกลับค่ะ 🙏\n" : "") + gpt.reply;
  if (replyToken) await replyText(replyToken, reply);
}





