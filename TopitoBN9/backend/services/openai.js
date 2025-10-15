const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

let client = null;

if (apiKey) {
  client = new OpenAI({ apiKey });
}

const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini';

async function generateStructuredResponse({
  prompt,
  persona,
  model = DEFAULT_MODEL,
  temperature = 0.2,
}) {
  if (!client) {
    const error = new Error('ยังไม่ได้ตั้งค่า OPENAI_API_KEY');
    error.status = 400;
    throw error;
  }

  const systemPrompt = [
    'คุณคือผู้ช่วยของ Telegram Bot ที่ช่วยตอบข้อความผู้ใช้เป็นภาษาไทยและอังกฤษได้',
    'ตอบกลับให้กระชับ ชัดเจน และระบุเฉพาะข้อมูลสำคัญ',
    persona ? `บุคลิกของบอท: ${persona}` : null,
    'หากไม่มีข้อมูลที่แน่ชัดให้ขอรายละเอียดเพิ่มเติมอย่างสุภาพ',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.responses.create({
    model,
    temperature,
    input: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const message = response.output?.[0]?.content?.[0]?.text;
  return (
    message ||
    'ขออภัยค่ะ ตอนนี้ยังไม่สามารถสร้างข้อความได้ กรุณาลองอีกครั้งหรือระบุข้อมูลเพิ่มเติม'
  );
}

module.exports = {
  generateStructuredResponse,
  DEFAULT_MODEL,
};
