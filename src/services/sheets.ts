// src/services/sheets.ts
// เขียนลง Google Sheets + แยกแท็บตามหมวด + ค้นลูกค้าเก่า
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL || '';
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const MASTER_TITLE_OVERRIDE = (process.env.MASTER_SHEET_TITLE || '').trim(); // ใช้แท็บนี้เป็น "รวม" ถ้ากำหนด

const jwt = new google.auth.JWT({
  email: SERVICE_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: jwt });

let cachedFirstTitle: string | null = null;

async function getFirstSheetTitle(): Promise<string> {
  if (MASTER_TITLE_OVERRIDE) return MASTER_TITLE_OVERRIDE;
  if (cachedFirstTitle) return cachedFirstTitle;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(title))',
  });
  const title = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
  cachedFirstTitle = title;
  return title;
}

/** ถ้าไม่มีแท็บชื่อนั้น จะสร้างให้ */
export async function ensureSheet(title: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(title))',
  });
  const exist = (meta.data.sheets || []).some(s => s.properties?.title === title);
  if (exist) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
}

/** append 1 แถวไปที่แท็บชื่อ title */
export async function appendToTab(title: string, values: (string | number)[]) {
  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    console.log('[Sheets MOCK]', title, values);
    return;
  }
  await ensureSheet(title);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${title}!A:F`, // 6 คอลัมน์พอดี
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

/** หา record ล่าสุดของ userId (ค้นในแท็บรวม) */
export async function findLastByUserId(userId: string): Promise<{ row: number; values: string[] } | null> {
  const master = await getFirstSheetTitle();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${master}!A:F`,
    majorDimension: 'ROWS',
  });
  const rows = resp.data.values || [];
  // โครง: [เวลา, userId, ข้อความ, หมวด, เหตุผล, คำตอบ]
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i];
    if ((r[1] || '') === userId) return { row: i + 1, values: r as string[] };
  }
  return null;
}

/** บันทึกทั้ง "แท็บรวม" (แท็บแรก) และแท็บตามหมวด */
export async function appendLog(category: string, values: (string | number)[]) {
  const master = await getFirstSheetTitle();
  await appendToTab(master, values);       // รวม
  await appendToTab(category, values);     // ตามหมวด
}



