// src/services/lineClient.ts
import crypto from 'crypto';

const TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const SECRET = process.env.LINE_CHANNEL_SECRET || '';

const isReal = !!(TOKEN && SECRET);

// ตรวจลายเซ็น (ถ้าไม่มี SECRET ให้ข้ามเป็น MOCK)
export function lineWebhookMiddleware(req: any, res: any, next: any) {
  if (!isReal) return next();

  const signature = req.get('X-Line-Signature') || '';
  const rawBody: Buffer = req.rawBody || Buffer.from('');
  const hmac = crypto.createHmac('sha256', SECRET).update(rawBody).digest('base64');

  const ok =
    signature.length === hmac.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));

  if (ok) return next();

  console.warn('[LINE] Invalid signature');
  return res.status(200).send('OK'); // กัน Verify fail
}

// ตอบ event แบบง่าย (echo)
export async function handleWebhookEvent(event: any) {
  if (!isReal) {
    console.log('[MOCK] event:', JSON.stringify(event));
    return;
  }
  if (event.type === 'message' && event.message?.type === 'text') {
    await replyText(event.replyToken, `คุณพิมพ์ว่า: ${event.message.text}`);
  }
}

// Push ข้อความ
export async function pushText(to: string, text: string) {
  if (!isReal) {
    console.log(`[MOCK] push to=${to} text=${text}`);
    return;
  }
  const resp = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error('[LINE push] error', resp.status, body);
    throw new Error(`LINE push failed: ${resp.status}`);
  }
}

// ภายใน: reply
async function replyText(replyToken: string, text: string) {
  if (!isReal) {
    console.log(`[MOCK] reply text=${text}`);
    return;
  }
  const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error('[LINE reply] error', resp.status, body);
  }
}


