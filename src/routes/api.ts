import { Router } from "express";
import { adminAuth } from "../middlewares/adminAuth";
import { fetchLogs, LogRow } from "../services/sheets";
import { buildStats } from "../services/analytics";
import OpenAI from "openai";

const router = Router();

/**
 * GET /api/logs
 * query:
 *   q=ค้นหา(ใน text/reply)
 *   category=ฝากเงิน|ถอน|...
 *   emotion=หงุดหงิด|รีบ|...
 *   start=2025-10-01
 *   end=2025-10-31
 *   userId=Uxxxx
 */
router.get("/logs", adminAuth, async (req, res) => {
  const { q, category, emotion, start, end, userId } = req.query as Record<string, string | undefined>;
  const logs = await fetchLogs();

  const startTs = start ? new Date(start).getTime() : undefined;
  const endTs   = end   ? new Date(end).getTime()   : undefined;

  const filtered = logs.filter(l => {
    if (userId && l.userId !== userId) return false;
    if (category && (l.category || "").toLowerCase() !== category.toLowerCase()) return false;
    if (emotion && (l.emotion || "").toLowerCase() !== emotion.toLowerCase()) return false;
    if (q) {
      const hay = `${l.text} ${l.reply}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    const t = new Date(l.timestamp).getTime();
    if (startTs && t < startTs) return false;
    if (endTs && t > endTs) return false;
    return true;
  });

  res.json({ ok: true, count: filtered.length, data: filtered });
});

/**
 * GET /api/stats
 */
router.get("/stats", adminAuth, async (_req, res) => {
  const logs = await fetchLogs();
  const stats = buildStats(logs);
  res.json({ ok: true, stats });
});

/**
 * POST /api/summarize
 * body: { items: LogRow[] } (ถ้าไม่ส่ง จะสรุปจาก filter ทั้งหมดของวันนี้)
 */
router.post("/summarize", adminAuth, async (req, res) => {
  const items: LogRow[] | undefined = req.body?.items;
  let data = items;
  if (!data) data = await fetchLogs(); // (จริงๆ ควรรับ query แล้วไป filter อีกรอบ)

  const brief = data!.slice(0, 50)   // กัน prompt ยาวเกิน
    .map((x) => `• [${x.timestamp}] (${x.category}/${x.emotion||"ปกติ"}) ${x.userId}: ${x.text}`)
    .join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `สรุป insight จากรายการแชทด้านล่างใน 5-8 ข้อ กระชับ เห็นภาพ พร้อม bullet point:
${brief}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const summary = resp.choices[0]?.message?.content || "(no summary)";
  res.json({ ok: true, summary });
});

export default router;
