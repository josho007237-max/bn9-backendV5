// src/services/sheets.ts
// เขียน log ลง Google Sheets: เวลา | userId | ข้อความ | หมวด | เหตุผล | คำตอบ

import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL || '';
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const jwt = new google.auth.JWT({
  email: SERVICE_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth: jwt });

export async function appendRow(values: (string | number)[]) {
  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    console.log('[Sheets MOCK] appendRow:', values);
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:Z', // เปลี่ยนชื่อชีตได้ตามจริง (ค่า default ของชีตใหม่คือ "Sheet1" หรือ "ตาราง1" ไทย -> ให้กด Rename เป็น "Sheet1")
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}
