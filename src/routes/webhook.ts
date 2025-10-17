import { Router } from "express";
import crypto from "crypto";
import { callOpenAI_JSON } from '../services/gpt.js';
import { lineReply } from "../services/lineClient.js";

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

    for (const ev of events) {
      if (ev.type === 'message' && ev.message?.type === 'text') {
        const text = ev.message.text?.trim() || '';
        const replyToken = ev.replyToken;

        const aiResponse = await callOpenAI_JSON(text);
        const replyText = aiResponse?.['ตอบลูกค้า'] || 'สวัสดีค่า 💖 พี่พลอย BN9 ยินดีช่วยนะคะ แจ้งรายละเอียดเพิ่มเติมได้เลยค่ะ';

        await lineReply(replyToken, [{ type: 'text', text: replyText }]);

        console.log('[LINE_LOG]', {
          userId: ev.source?.userId,
          text,
          category: aiResponse?.['หมวด'],
          emotion: aiResponse?.['อารมณ์ลูกค้า'],
          tone: aiResponse?.['โทนการตอบ'],
          reason: aiResponse?.['เหตุผล'],
        });
      }
    }
  } catch (e) {
    console.error("LINE webhook error:", e);
    // We've already sent a 200, so we just log the error.
  }
});

export default router;
