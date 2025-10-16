// src/server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { lineWebhookMiddleware, handleWebhookEvent, pushText } from './services/lineClient';

// ---------- App & Config ----------
const app = express();
const PORT = Number(process.env.PORT || 8080);

// CORS + Logging
app.use(
  cors({
    origin: (_origin, cb) => cb(null, true),
    credentials: false,
  }),
);
app.use(morgan('dev'));

// เก็บ raw body สำหรับตรวจลายเซ็น LINE
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// ---------- Root & Health ----------
app.all('/', (_req, res) => res.status(200).send('BN9 Backend เปิดใช้งานแล้ว ✅'));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, ts: new Date().toISOString() }));

// ---------- API: Push ----------
app.post('/api/push', async (req: Request, res: Response) => {
  try {
    const { to, text } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'Missing "to" or "text"' });
    await pushText(to, text);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Push API error:', err);
    res.status(500).json({ ok: false, error: 'Push failed' });
  }
});

// ---------- LINE Webhook ----------
app.post('/webhook', lineWebhookMiddleware as any, async (req: Request, res: Response) => {
  try {
    const events = (req.body && (req.body as any).events) || [];
    for (const ev of events) {
      await handleWebhookEvent(ev);
    }
    res.status(200).send('OK'); // ต้องตอบ 200 เสมอ
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send('OK');
  }
});

// ---------- 404 & Error ----------
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => console.log(`BN9 backend running on :${PORT}`));

export default app;





