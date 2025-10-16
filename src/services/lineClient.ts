// src/services/lineClient.ts
// LINE client + middleware ตรวจลายเซ็น + ตัวจัดการ event (รวม GPT+Sheets ในที่เดียว)

import crypto from 'crypto';
import { classifyAndRespond } from './gpt';
import { appendRow } from './sheets';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';

/** ส่ง push ข้อความถึง userId */
export async function pushText(to: string, text: string) {
  if (!LINE_TOKEN) {
    console.log('[LINE MOCK] push to=%s text=%s', to, text);
    return;
  }
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LINE push error ${r.status}: ${t}`);
  }
}

/** ตอบกลับข้อความด้วย replyToken */
export async function replyText(replyToken: string, text: string) {
  if (!LINE_TOKEN) {
    console.log('[LINE MOCK] reply text=%s', text);
    return;
  }
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LINE reply error ${r.status}: ${t}`);
  }
}

/** ตรวจลายเซ็นจาก LINE (ถ้ามี secret) */
export function lineWebhookMiddleware(req: any, res: any, next: any) {
  if (!LINE_SECRET) return next(); // ไม่มี secret → โหมด MOCK/ข้ามตรวจ

  try {
    const signature = req.get('x-line-signature') || '';
    const body = req.rawBody || Buffer.from('');
    const hmac = crypto.createHmac('sha256', LINE_SECRET).update(body).digest('base64');

    if (signature !== hmac) {
      console.warn('LINE signature mismatch');
      return res.status(401).send('Bad signature');
    }
    next();
  } catch (err) {
    console.error('lineWebhookMiddleware error:', err);
    res.status(401).send('Signature check fail');
  }
}

/** ตัวจัดการ event หลัก (ผูก GPT + Sheets + ตอบกลับ) */
export async function handleWebhookEvent(ev: any) {
  try {
    if (ev.type === 'message' && ev.message?.type === 'text') {
      const userId: string = ev.source?.userId || '';
      const userText: string = ev.message?.text || '';
      const replyToken: string = ev.replyToken;

      // 1) ให้ GPT สร้างคำตอบ + จัดหมวด
      const result = await classifyAndRespond(userText);

      // 2) บันทึกลง Google Sheets
      const ts = new Date().toISOString();
      await appendRow([ts, userId, userText, result.category, result.reason, result.reply]);

      // 3) ตอบกลับผู้ใช้
      if (replyToken) {
        await replyText(replyToken, result.reply);
      } else if (userId) {
        await pushText(userId, result.reply);
      }
      return;
    }

    // กรณี event อื่น ๆ ที่ยังไม่รองรับ
    console.log('[LINE] event passthrough:', ev.type);
  } catch (err) {
    console.error('handleWebhookEvent error:', err);
  }
}



