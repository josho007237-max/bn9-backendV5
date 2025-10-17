import express from "express";
import { getLogs } from "../services/sheets";
import { lineReply, linePush, lineAlert } from "../services/lineClient";

const router = express.Router();

/**
 * GET /api/logs?limit=50
 * ดึง log ล่าสุดจาก Google Sheets (mapped เป็น object)
 */
router.get("/logs", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const rows = await getLogs(limit);
    res.json({ ok: true, rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * POST /api/reply
 * body: { replyToken?: string, userId?: string, text: string }
 * ถ้ามี replyToken จะใช้ reply, ถ้ามี userId จะใช้ push
 */
router.post("/reply", async (req, res) => {
  try {
    const { replyToken, userId, text } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: "text is required" });

    if (replyToken)      await lineReply(replyToken, text);
    else if (userId)     await linePush(userId, text);
    else return res.status(400).json({ ok: false, error: "replyToken or userId is required" });

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * POST /api/alert
 * body: { message: string }
 */
router.post("/alert", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ ok: false, error: "message is required" });
    await lineAlert(message);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;




