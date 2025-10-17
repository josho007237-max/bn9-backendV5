// src/services/gpt.ts

import { systemAdvanced, userAdvanced, AdvancedResponse } from './prompts';

export type GPTResult = { reply: string; category: string; reason: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini';

/**
 * Calls OpenAI to get a structured JSON response based on user text.
 * Uses the "Advanced" persona for "พี่พลอย BN9".
 * @param userText The text from the user.
 * @returns A structured response object or a fallback object on error.
 */
export async function callOpenAI_JSON(userText: string): Promise<AdvancedResponse> {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not set. Returning mock data.');
    return {
      'ตอบลูกค้า': `พี่พลอยรับเรื่องแล้วนะคะ: "${userText}" (นี่คือข้อความทดสอบเนื่องจากไม่มี API Key)`,
      'หมวด': 'อื่นๆ',
      'อารมณ์ลูกค้า': 'ไม่ชัดเจน',
      'โทนการตอบ': 'เป็นกลาง',
      'เหตุผล': 'ไม่มี OPENAI_API_KEY',
    };
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemAdvanced },
      { role: 'user', content: userAdvanced(userText) },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  };

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`OpenAI API error ${r.status}: ${errorText}`);
    }

    const data: any = await r.json();
    const rawContent = data?.choices?.[0]?.message?.content ?? '{}';

    const parsed = JSON.parse(rawContent);
    if (!parsed || typeof parsed !== 'object' || !parsed['ตอบลูกค้า']) {
      throw new Error('Invalid JSON structure from OpenAI');
    }

    return parsed as AdvancedResponse;
  } catch (e) {
    console.error('OpenAI call failed:', e);
    return {
      'ตอบลูกค้า': 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว 🙏 ลองทักมาอีกครั้งได้นะคะ',
      'หมวด': 'อื่นๆ',
      'อารมณ์ลูกค้า': 'ไม่ชัดเจน',
      'โทนการตอบ': 'ขอโทษ',
      'เหตุผล': 'เกิดข้อผิดพลาดขณะเรียกใช้งาน OpenAI',
    };
  }
}
