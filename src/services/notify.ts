// src/services/notify.ts
export function shouldAlert(category: string): boolean {
  const raw = process.env.ALERT_CATEGORIES || '';
  if (!raw.trim()) return false;
  return raw.split(',').map(s => s.trim()).filter(Boolean).includes(category);
}

export async function sendLineNotify(text: string) {
  const token = process.env.LINE_NOTIFY_TOKEN || '';
  if (!token) {
    console.log('[Notify MOCK]', text);
    return;
  }
  const form = new URLSearchParams({ message: text });
  const r = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LINE Notify ${r.status}: ${t}`);
  }
}
