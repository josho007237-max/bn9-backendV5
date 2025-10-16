// src/services/sheets.ts
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL || "";
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const MASTER_TITLE_OVERRIDE = (process.env.MASTER_SHEET_TITLE || "").trim();

const jwt = new google.auth.JWT({
  email: SERVICE_EMAIL,
  key: PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth: jwt });

let cachedFirstTitle: string | null = null;

async function getFirstSheetTitle(): Promise<string> {
  if (MASTER_TITLE_OVERRIDE) return MASTER_TITLE_OVERRIDE;
  if (cachedFirstTitle) return cachedFirstTitle;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets(properties(title))",
  });
  const title = meta.data.sheets?.[0]?.properties?.title || "Sheet1";
  cachedFirstTitle = title;
  return title;
}

export async function ensureSheet(title: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets(properties(title))",
  });
  const exist = (meta.data.sheets || []).some((s) => s.properties?.title === title);
  if (exist) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
}

export async function appendToTab(title: string, values: (string | number)[]) {
  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    console.log("[Sheets MOCK]", title, values);
    return;
  }
  await ensureSheet(title);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${title}!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function findLastByUserId(userId: string) {
  const master = await getFirstSheetTitle();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${master}!A:F`,
    majorDimension: "ROWS",
  });
  const rows = resp.data.values || [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i];
    if ((r[1] || "") === userId) return { row: i + 1, values: r };
  }
  return null;
}

export async function appendLog(category: string, values: (string | number)[]) {
  const master = await getFirstSheetTitle();
  await appendToTab(master, values);
  await appendToTab(category, values);
}




