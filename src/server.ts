import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { lineWebhookMiddleware } from "./services/lineClient.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ... (มีพวก route ของ LINE อยู่ข้างล่างนี้)
app.post("/webhook", lineWebhookMiddleware, (req, res) => {
  res.json({ ok: true });
});

// ⬇️⬇️ ให้เพิ่มตรงนี้ได้เลย ⬇️⬇️

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// ⬆️⬆️ แล้วค่อยตามด้วย listen ด้านล่าง ⬆️⬆️

app.listen(process.env.PORT || 8080, () => {
  console.log(`BN9 backend running on :${process.env.PORT || 8080}`);
});


