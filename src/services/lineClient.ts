// src/services/lineClient.ts
import crypto from 'crypto';
import { classifyAndRespond } from './gpt';
import { appendLog, findLastByUserId } from './sheets';
import { shouldAlert, sendLineNotify } from './notify';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';

export async function pushText(to: string, text: string) { /* เดิมของน้อง ใช้ได้ */ 
  if (!LINE_TOKEN) { console.log('[LINE MOCK] push', to, text); return; }
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!r.ok) throw new Error(`LINE push ${r.status}: ${await r.text()}`);
}

export async function replyText(replyToken: string, text: string) {
  if (!LINE_TOKEN) { console.log('[LINE MOCK] reply', text); return; }
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  if (!r.ok) throw new Error(`LINE reply ${r.status}: ${await r.text()}`);
}

export function lineWebhookMiddleware(req: any, res: any, next: any) {
  if (!LINE_SECRET) return next();
  try {
    const sig = req.get('x-line-signature') || '';
    const raw = req.rawBody || Buffer.from('');
    const hmac = crypto.createHmac('sha256', LINE_SECRET).update(raw).digest('base64');
    if (sig !== hmac) return res.status(401).send('Bad signature');
    next();
  } catch (e) {
    console.error('signature check:', e);
    res.status(401).send('Bad signature');
  }
}

export async function handleWebhookEvent(ev: any) {
  if (ev.type !== 'message' || ev.message?.type !== 'text') return;

  const userId: string = ev.source?.userId || '';
  const text: string = ev.message?.text || '';
  const replyToken: string = ev.replyToken || '';

  // 1) เช็คลูกค้าเก่า
  const last = userId ? await findLastByUserId(userId) : null;
  const returning = !!last;

  // 2) GPT จัดหมวด/ตอบ
  const gpt = await classifyAndRespond(text);
  const ts = new Date().toISOString();

  // 3) บันทึก (แท็บรวม + แท็บตามหมวด)
  await appendLog(gpt.category, [ts, userId, text, gpt.category, gpt.reason, gpt.reply]);

  // 4) แจ้งเตือนแอดมิน (เฉพาะหมวดที่กำหนด)
  if (shouldAlert(gpt.category)) {
    const msg = [
      '📣 เคสใหม่ (BN9)',
      `หมวด: ${gpt.category}`,
      `user: ${userId || '-'}`,
      `ลูกค้า: ${text}`,
      `สรุป: ${gpt.reason}`,
      returning ? '🟡 ลูกค้าเก่า' : '🟢 ลูกค้าใหม่',
    ].join('\n');
    await sendLineNotify(msg);
  }

  // 5) ตอบกลับลูกค้า (ใส่โทน “จำได้ว่าเคยคุย” ถ้า returning)
  const reply = (returning ? 'ยินดีต้อนรับกลับค่ะ 🙏\n' : '') + gpt.reply;
  if (replyToken) await replyText(replyToken, reply);
}




