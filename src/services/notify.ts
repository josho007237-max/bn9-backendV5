// src/services/notify.ts
// ใช้ Messaging API แจ้งเตือนแอดมินหรือกลุ่ม LINE แทน LINE Notify

import fetch from "node-fetch";

// ใช้ LINE Messaging API (จาก Official Account ของเรา)
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const ADMIN_USER_ID = process.env.ADMIN_LINE_USERID || ""; // userId ของแอดมิน/กลุ่ม

/** ตรวจว่าหมวดนี้ควรแจ้งเตือนหรือไม่ */
export function shouldAlert(category: string): boolean {
  const raw = process.env.ALERT_CATEGORIES || "";
  if (!raw.trim()) return false;
  return raw.split(",").map((s) => s.trim()).includes(category);
}

/** ส่งข้อความแจ้งเตือนเข้า LINE โดยตรง (ผ่าน Messaging API) */
export async function sendAlertMessage(message: string, userId?: string) {
  const to = userId || ADMIN_USER_ID;
  if (!LINE_TOKEN || !to) {
    console.log("[Alert MOCK]", message);
    return;
  }

  const body = {
    to,
    messages: [{ type: "text", text: message }],
  };

  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("LINE alert failed:", r.status, t);
  } else {
    console.log("✅ LINE alert sent successfully");
  }
}


