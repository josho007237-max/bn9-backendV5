// src/services/sheets.ts
// เขียนลง Google Sheets: เวลา | userId | ข้อความ | หมวด | เหตุผล | คำตอบ
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL || '';
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
// กำหนดช่วงคอลัมน์ผ่าน ENV ได้ (เช่น "ตาราง1!A:F" หรือ "Sheet1!A:Z")
// ถ้าไม่ใส่ จะ auto-detect ชื่อแท็บแล้วใช้ "<tab>!A:F"
const RANGE_FROM_ENV = process.env.GOOGLE_SHEET_RANGE; // optional

const jwt = new google.auth.JWT({
  email: SERVICE_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: jwt });

let cachedTabTitle: string | null = null;

async function getFirstSheetTitle(): Promise<string> {
  if (RANGE_FROM_ENV) return RANGE_FROM_ENV.split('!')[0]; // ถ้าให้ range มาชัดเจนแล้วใช้เลย
  if (cachedTabTitle) return cachedTabTitle;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(title))',
  });
  const title = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
  cachedTabTitle = title;
  return title;
}

export async function appendRow(values: (string | number)[]) {
  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    console.log('[Sheets MOCK] appendRow:', values);
    return;
  }

  const title = await getFirstSheetTitle();
  const range = RANGE_FROM_ENV ?? `${title}!A:F`; // เขียน 6 คอลัมน์พอดี

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}


