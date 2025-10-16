// src/server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';

// ใช้ชื่อไฟล์แบบไม่ใส่ .js (เพราะเราคอมไพล์เป็น CommonJS)
import { lineWebhookMiddleware, handleWebhookEvent, pushText } from './services/lineClient';

const app = express();
const PORT = Number(process.env.PORT || 8080);

// CORS
app.use(cors({ origin: (_origin, cb) => cb(null, true) }));

// Log
app.use(morgan('dev'));

// เก็บ rawBody สำหรับตรวจลายเซ็น LINE
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Root
app.all('/', (_req, res) => {
  res.status(200).send('BN9 Backend is live ✅');
});

// Health
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Push message
app.post('/api/push', async (req: Request, res: Response) => {
  try {
    const { to, text } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'Missing "to" or "text"' });
    await pushText(to, text);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Push API error:', err);
    return res.status(500).json({ ok: false, error: 'Push failed' });
  }
});

// Webhook (ตอบ 200 เสมอ)
app.post('/webhook', lineWebhookMiddleware as any, async (req: Request, res: Response) => {
  try {
    const events = (req.body && (req.body as any).events) || [];
    for (const ev of events) {
      await handleWebhookEvent(ev);
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send('OK');
  }
});

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BN9 backend running on :${PORT}`);
});

export default app;




