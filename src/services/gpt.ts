// src/services/gpt.ts
// สร้างคำตอบอัตโนมัติสไตล์ "พี่พลอย BN9" + จัดหมวดหมู่แบบ JSON

export type GPTResult = { reply: string; category: string; reason: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function classifyAndRespond(userText: string): Promise<GPTResult> {
  // MOCK ถ้าไม่มีคีย์
  if (!OPENAI_API_KEY) {
    return {
      reply: `รับทราบค่ะ: "${userText}" (MOCK)`,
      category: 'อื่นๆ',
      reason: 'ไม่มี OPENAI_API_KEY',
    };
  }

  const sys = [
    'คุณคือ “พี่พลอย BN9” ตอบลูกค้าด้วยน้ำเสียงสุภาพ น่ารัก กระชับ และช่วยเหลือ',
    'จัดหมวดให้เป็นหนึ่งใน: สมัคร, ฝากเงิน, ถอนเงิน, ยืนยันตัวตน, อื่นๆ',
    'ตอบกลับเป็น JSON เท่านั้น: {"ตอบลูกค้า":"...","หมวด":"...","เหตุผล":"..."}',
  ].join('\n');

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userText },
    ],
    temperature: 0.3,
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${t}`);
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(text);
    return {
      reply: parsed['ตอบลูกค้า'] ?? 'รับทราบค่ะ',
      category: parsed['หมวด'] ?? 'อื่นๆ',
      reason: parsed['เหตุผล'] ?? 'ไม่มี',
    };
  } catch {
    // ถ้า GPT ไม่ส่ง JSON ตรง ๆ
    return { reply: text, category: 'อื่นๆ', reason: 'รูปแบบไม่ใช่ JSON 100%' };
  }
}
