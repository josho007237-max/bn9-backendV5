// src/services/lineClient.ts
import crypto from 'crypto';

const TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const SECRET = process.env.LINE_CHANNEL_SECRET || '';

/**
 * โหมดจริง = มีทั้ง TOKEN + SECRET
 * โหมด MOCK = ไม่มี credentials จะไม่ยิงไป LINE จริง แค่ console.log
 */
const isReal = !!(TOKEN && SECRET);

/**
 * มิดเดิลแวร์ตรวจลายเซ็น LINE (ถ้ามี SECRET)
 * - ต้องใช้ req.rawBody (ถูกตั้งค่าใน server.ts)
 * - ถ้าไม่ผ่าน ให้ตอบ 200 แล้วข้ามการประมวลผล (กัน Verify fail)
 */
export function lineWebhookMiddleware(req: any, res: any, next: any) {
  if (!isReal) return next(); // MOCK: ข้ามการตรวจลายเซ็น

  const signature = req.get('X-Line-Signature') || '';
  const rawBody: Buffer = req.rawBody || Buffer.from('');
  const hmac = crypto.createHmac('sha256', SECRET).update(rawBody).digest('base64');

  const ok =
    signature.length === hmac.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));

  if (ok) return next();

  console.warn('[LINE] Invalid signature');
  // ส่ง 200 กลับ เพื่อไม่ให้ Verify fail แต่ไม่ประมวลผล event
  return res.status(200).send('OK');
}

/**
 * ตัวอย่าง handler แบบง่าย:
 * - ถ้าเป็นข้อความ text จะ echo กลับ
 * - โหมด MOCK แค่ log event
 */
export async function handleWebhookEvent(event: any) {
  if (!isReal) {
    console.log('[MOCK] event:', JSON.stringify(event));
    return;
  }
  if (event.type === 'message' && event.message?.type === 'text') {
    await replyText(event.replyToken, `คุณพิมพ์ว่า: ${event.message.text}`);
  }
}

/**
 * Push ข้อความ (ต้องมี userId/roomId/groupId ใน field "to")
 */
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

/** ใช้ภายใน: reply ตาม replyToken */
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



