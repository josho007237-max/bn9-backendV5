import express, { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import Ajv from "ajv";
import { lineClient, lineWebhookMiddleware } from "./services/lineClient.js";

dotenv.config();
const PORT = Number(process.env.PORT || 8080);
const DASHBOARD_KEY = process.env.DASHBOARD_API_KEY || "";
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || "*").split(",").map(s => s.trim()).filter(Boolean);

const app = express();

app.use(morgan("tiny"));
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOW_ORIGINS.includes("*") || ALLOW_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  allowedHeaders: ["Content-Type","Authorization"],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"]
}));

// Middleware to attach raw body for LINE webhook verification
app.use(express.json({
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));


app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, env: process.env.RAILWAY_ENVIRONMENT || "local", time: new Date().toISOString() });
});

function requireDashboardAuth(req: Request, res: Response, next: NextFunction) {
  if (!DASHBOARD_KEY) return res.status(500).send("Server missing DASHBOARD_API_KEY");
  const auth = req.get("authorization") ?? "";
  if (auth === `Bearer ${DASHBOARD_KEY}`) return next();
  return res.status(401).send("Unauthorized");
}

app.get("/api/activity/logs", requireDashboardAuth, (_req, res) => {
  res.json({ activities: [
    { botName: "BN9", platform: "LINE", userId: "Uxxxxxxxx", message: "สวัสดีครับ", time: new Date().toISOString() }
  ]});
});

app.post("/api/activity/summarize-ai", requireDashboardAuth, (_req: Request, res: Response) => {
  res.json({ title: "Today Summary", summary: "ผู้ใช้ถามโปร ฯ และวิธีเติมเงินบ่อยครั้ง", insights: ["ทำ Quick Reply เกี่ยวกับโปร","เพิ่ม How-to เติมเงิน","แจ้งเวลาตอบกลับอัตโนมัติ"] });
});

app.post("/api/commands/generate", requireDashboardAuth, (req: Request, res: Response) => {
  const { platform, description, examples } = req.body ?? {};
  res.json({ commandName: `cmd_${(platform||'generic').toLowerCase()}`, code: `// ${platform} command for: ${description}\n// examples: ${examples || '-'}\nfunction run(){ console.log('BN9 command'); }`, usage: "Copy & paste to your bot command handler" });
});

const ajv = new Ajv({ allErrors: true });
const flexSchema = { type: "object", required: ["type","body"], properties: { type: { const: "bubble" }, body: { type: "object" } }, additionalProperties: true };
const validateFlex = ajv.compile(flexSchema);
app.post("/api/flex/validate", requireDashboardAuth, (req: Request, res: Response) => {
  const ok = validateFlex(req.body);
  if (!ok) return res.status(400).json({ ok: false, errors: validateFlex.errors });
  res.json({ ok: true });
});
app.post("/api/flex/preview", requireDashboardAuth, (req: Request, res: Response) => {
  const payload = req.body;
  const ok = validateFlex(payload);
  if (!ok) return res.status(400).json({ ok: false, errors: validateFlex.errors });
  res.json({ preview: { messages: [{ type: "flex", altText: "Preview", contents: payload }] } });
});

app.post("/api/push", requireDashboardAuth, async (req: Request, res: Response) => {
  try {
    const { to, text, flex } = req.body ?? {};
    if (!to) return res.status(400).json({ error: "Missing 'to'" });
    if (!text && !flex) return res.status(400).json({ error: "Provide 'text' or 'flex'" });
    const messages = [];
    if (flex) messages.push({ type: "flex", altText: text || "BN9 Dashboard message", contents: flex });
    if (text && !flex) messages.push({ type: "text", text });
    await lineClient.pushMessage(to, messages);
    res.json({ ok: true });
  } catch (e) {
    const error = e as Error & { statusCode?: number, statusMessage?: string };
    res.status(error.statusCode || 500).json({ error: error.statusMessage || error.message || String(e) });
  }
});

app.post("/api/richmenu/create", requireDashboardAuth, async (req: Request, res: Response) => {
  try {
    const id = await lineClient.createRichMenu(req.body);
    res.json({ richMenuId: id });
  } catch (e) {
    const error = e as Error & { statusCode?: number, statusMessage?: string };
    res.status(error.statusCode || 500).json({ error: error.statusMessage || error.message || String(e) });
  }
});
app.post("/api/richmenu/link", requireDashboardAuth, async (req: Request, res: Response) => {
  try {
    const { userId, richMenuId } = req.body ?? {};
    if (!userId || !richMenuId) return res.status(400).json({ error: "userId and richMenuId are required" });
    await lineClient.linkRichMenuToUser(userId, richMenuId);
    res.json({ ok: true });
  } catch (e) {
    const error = e as Error & { statusCode?: number, statusMessage?: string };
    res.status(error.statusCode || 500).json({ error: error.statusMessage || error.message || String(e) });
  }
});

app.post("/webhook/line", lineWebhookMiddleware, async (_req: Request, res: Response) => { res.status(200).end(); });

app.listen(PORT, () => console.log(`BN9 backend running on :${PORT}`));
