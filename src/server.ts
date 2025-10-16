// src/server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';

// === LINE client helpers (ต้องมีไฟล์ src/services/lineClient.ts ตามโปรเจกต์คุณ) ===
/**
 * ควร export ฟังก์ชัน/มิดเดิลแวร์เหล่านี้จาก src/services/lineClient.ts
 * - lineWebhookMiddleware: ตรวจ LINE signature ถ้ามี CHANNEL_SECRET; ถ้าไม่มีให้ข้าม (MOCK)
 * - handleWebhookEvent(event): โค้ดจัดการ event ต่าง ๆ (message, follow, ฯลฯ)
 * - pushText(to: string, text: string): ส่ง push message; ถ้าไม่มี token ให้ LOG (MOCK)
 */
import { lineWebhookMiddleware, handleWebhookEvent, pushText } from './services/lineClient.js';
// ---------- App & Config ----------
const app = express();

const PORT = Number(process.env.PORT || 8080);
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || '*')
  .split(',')
  .map(s => s.trim());

// CORS (อนุญาตทุกที่ หรือกำหนดเป็นโดเมน , คั่นได้)
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: false,
  }),
);

// Logging
app.use(morgan('dev'));

// เก็บ raw body ไว้ให้ middleware ตรวจลายเซ็นของ LINE ได้ (ถ้าจำเป็น)
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf; // ให้ lineWebhookMiddleware เอาไปคำนวณ HMAC ได้
    },
  }),
);

// ---------- Root & Health ----------
app.all('/', (_req, res) => {
  res.status(200).send('BN9 Backend is live ✅');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// ---------- API: Push message ----------
/**
 * POST /api/push
 * body: { "to": "<userId>", "text": "<message>" }
 */
app.post('/api/push', async (req: Request, res: Response) => {
  try {
    const { to, text } = req.body || {};
    if (!to || !text) {
      return res.status(400).json({ error: 'Missing "to" or "text"' });
    }
    await pushText(to, text);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Push API error:', err);
    return res.status(500).json({ ok: false, error: 'Push failed' });
  }
});

// ---------- LINE Webhook ----------
/**
 * LINE จะยิง POST มาที่ /webhook
 * - ต้องตอบ 200 เสมอ เพื่อให้ Verify ผ่าน
 * - ใช้ lineWebhookMiddleware เพื่อตรวจลายเซ็น (ถ้ามี secret)
 */
app.post('/webhook', lineWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const events = (req.body && (req.body as any).events) || [];
    for (const ev of events) {
      await handleWebhookEvent(ev);
    }
    // สำคัญมาก: ต้องตอบ 200 เสมอ
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    // ตอบ 200 กลับเสมอ เพื่อไม่ให้ LINE ขึ้น verify fail
    res.status(200).send('OK');
  }
});

// ---------- 404 ----------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ---------- Error Handler ----------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ---------- Start Server ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BN9 backend running on :${PORT}`);
});

export default app;


