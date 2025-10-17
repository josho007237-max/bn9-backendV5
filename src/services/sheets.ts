import { google } from "googleapis";

const GOOGLE_SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL;
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const MASTER_SHEET_TITLE = process.env.MASTER_SHEET_TITLE || "BN9 Logs";

function ensureEnv() {
  if (!GOOGLE_SERVICE_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    throw new Error("Google Sheets env is not fully configured");
  }
}

function getSheets() {
  ensureEnv();
  const jwt = new google.auth.JWT(
    GOOGLE_SERVICE_EMAIL,
    undefined,
    GOOGLE_PRIVATE_KEY,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  return google.sheets({ version: "v4", auth: jwt });
}

// Append one row: [timestamp, userId, userText, category, reason, emotion, tone, botReply]
export async function appendLogRow(values: (string | number)[]) {
  const sheets = getSheets();
  const range = `'${MASTER_SHEET_TITLE}'!A:H`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID!,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] }
  });
}

// Get last N rows (mapped)
export async function getLogs(limit = 50) {
  const sheets = getSheets();
  const range = `'${MASTER_SHEET_TITLE}'!A:H`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID!,
    range
  });
  const rows = res.data.values || [];
  const slice = rows.slice(-limit);
  return slice.map(r => ({
    timestamp: r[0] || "",
    userId:    r[1] || "",
    userText:  r[2] || "",
    category:  r[3] || "",
    reason:    r[4] || "",
    emotion:   r[5] || "",
    tone:      r[6] || "",
    botReply:  r[7] || ""
  }));
}









