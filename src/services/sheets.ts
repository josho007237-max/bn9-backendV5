import { google, sheets_v4 } from "googleapis";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const rangeName = "Logs!A:G"; // ปรับตามคอลัมน์จริง

function getSheets(): sheets_v4.Sheets {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_EMAIL,
    key: process.env.GOOGLE_SERVICE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: jwt });
}

export type LogRow = {
  timestamp: string;  // ISO
  userId: string;
  text: string;
  reply: string;
  category: string;   // ฝากเงิน/ถอน/สมัคร/อื่นๆ...
  emotion?: string;   // หงุดหงิด/รีบ/...
  isUrgent?: boolean; // true/false
};

// Append one row: [timestamp, userId, text, reply, category, emotion, isUrgent]
export async function appendLogRow(values: (string | number)[]) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID!,
    range: rangeName,
    valueInputOption: "RAW",
    requestBody: { values: [values] }
  });
}

export async function fetchLogs(): Promise<LogRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID!,
    range: rangeName,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  const header = rows[0].map((h) => (h || "").toString().trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const tIdx = idx("timestamp");
  const uIdx = idx("userId");
  const xIdx = idx("text");
  const rIdx = idx("reply");
  const cIdx = idx("category");
  const eIdx = idx("emotion");
  const zIdx = idx("isUrgent");

  return rows.slice(1).map((r) => ({
    timestamp: r[tIdx] || "",
    userId: r[uIdx] || "",
    text: r[xIdx] || "",
    reply: r[rIdx] || "",
    category: r[cIdx] || "",
    emotion: r[eIdx] || "",
    isUrgent: (r[zIdx] || "").toString().toLowerCase() === "true",
  })).filter(r => r.timestamp); // Filter out empty rows
}
