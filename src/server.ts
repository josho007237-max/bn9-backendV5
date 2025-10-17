import "dotenv/config";
import express from "express";
import cors from "cors";
import apiRouter from "./routes/api"; // ✅ เพิ่มตรงนี้
import webhookRouter from "./routes/webhook";
const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true })); // dev ง่ายก่อน
 
app.use("/api", apiRouter);
 
// ===== Safe CORS =====
const allowAll = (process.env.ALLOW_ORIGINS || "").trim() === "*";
const allowList = (process.env.ALLOW_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function wildcardToRegex(p: string) {
  // escape อักขระ regex ก่อน แล้วค่อยแปลง * -> .*
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const re = "^" + esc.replace(/\*/g, ".*") + "$";
  return new RegExp(re);
}

const originChecker: cors.CorsOptions["origin"] = allowAll
  ? true
  : (origin, cb) => {
      if (!origin) return cb(null, true); // อนุญาตเครื่องมือที่ไม่มี origin
      const ok = allowList.some(p => {
        if (p === origin) return true;                 // ตรงตัว
        if (p.includes("*")) return wildcardToRegex(p).test(origin); // เช่น *.netlify.app
        if (p.startsWith("/") && p.endsWith("/")) {
          try { return new RegExp(p.slice(1, -1)).test(origin); } catch { return false; }
        }
        return false;
      });
      cb(null, ok);
    };

app.use(cors({ origin: originChecker, credentials: false }));