import { Router } from "express";
import crypto from "crypto";
import { callOpenAI_JSON } from '../services/gpt.js';
import { lineReply } from "../services/lineClient.js";
import { appendLogRow } from "../services/sheets.js";
import { sendAlertMessage, shouldAlert } from "../services/notify.js";

const router = Router();

const LINE_SECRET = process.env.LINE_CHANNEL_SECRET;

/**
 * Middleware to verify LINE signature.
 * It uses raw body which should be enabled in the main server file.
 */
const verifyLineSignature = (req: any, res: any, next: any) => {
  // Signature verification can be disabled for local development
  if (process.env.LINE_VERIFY_SIGNATURE === "false") {
    return next();
  }

  if (!LINE_SECRET) {
    console.warn("LINE_CHANNEL_SECRET is not set. Skipping signature verification.");
    return next();
  }

  const signature = req.headers['x-line-signature'] as string;
  if (!signature) {
    return res.status(401).send("Bad signature: signature not provided");
  }

  const body = req.rawBody; // Assumes raw-body middleware is used
  const hmac = crypto.createHmac("sha256", LINE_SECRET).update(body).digest("base64");

  if (hmac !== signature) {
    return res.status(401).send("Bad signature: signature mismatch");
  }

  next();
};

router.post("/", verifyLineSignature, async (req, res) => {
  try {
    const events = req.body?.events || [];
    // Respond to LINE quickly to prevent timeout
    res.status(200).end();

    // --- Process each event asynchronously ---
    for (const ev of events) {
      // We don't await here to allow processing multiple events in parallel
      // if LINE sends them in a single webhook call.
      processEvent(ev).catch(e => {
        console.error("Error processing event:", e);
      });
    }
  } catch (e) {
    // This will catch errors from verifyLineSignature or initial body parsing
    console.error("LINE webhook initial error:", e);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
});

async function processEvent(ev: any) {
  if (ev.type === 'message' && ev.message?.type === 'text') {
    const text = ev.message.text?.trim() || '';
    const replyToken = ev.replyToken;
    const userId = ev.source?.userId || 'N/A';

    // Step 1: Get AI response for classification and reply generation
    const aiResponse = await callOpenAI_JSON(text);
    const replyText = aiResponse?.['ตอบลูกค้า'] || 'สวัสดีค่า 💖 พี่พลอย BN9 ยินดีช่วยนะคะ แจ้งรายละเอียดเพิ่มเติมได้เลยค่ะ';

    // Step 2: Reply to the user
    await lineReply(replyToken, [{ type: 'text', text: replyText }]);

    // Step 3: Prepare data for logging
    const category = aiResponse?.['หมวด'] || 'อื่นๆ';
    const emotion = aiResponse?.['อารมณ์ลูกค้า'] || 'ไม่ชัดเจน';
    const isUrgent = shouldAlert(category);

    // Step 4: Save the complete log to Google Sheets
    await appendLogRow([
      new Date().toISOString(),
      userId, text, replyText, category, emotion, String(isUrgent).toLowerCase()
    ]);

    // Step 5: Send an alert to the admin if the category is marked as urgent
    if (isUrgent) {
      await sendAlertMessage(`🚨 Urgent: [${category}] from ${userId}\nText: ${text}`);
    }
  }
}

export default router;
