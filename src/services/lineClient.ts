// ใช้ fetch ของ Node 18+ (global) ไม่ต้องลง node-fetch
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const LINE_ADMIN_GROUP_ID = process.env.LINE_ADMIN_GROUP_ID || "";

type LineMessage = { type: "text"; text: string };

export async function lineReply(replyToken: string, messages: LineMessage[] | string) {
  const body = {
    replyToken,
    messages: typeof messages === "string" ? [{ type: "text", text: messages }] : messages
  };
  const r = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`LINE reply failed: ${r.status} ${txt}`);
  }
}

export async function linePush(to: string, messages: LineMessage[] | string) {
  const body = {
    to,
    messages: typeof messages === "string" ? [{ type: "text", text: messages }] : messages
  };
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`LINE push failed: ${r.status} ${txt}`);
  }
}

export async function lineAlert(message: string) {
  if (!LINE_ADMIN_GROUP_ID) return;
  await linePush(LINE_ADMIN_GROUP_ID, message);
}
