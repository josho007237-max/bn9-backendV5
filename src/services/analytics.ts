import { LogRow } from "./sheets";

export type Stats = {
  totalMessages: number;
  uniqueUsers: number;
  repeatCustomers: number;   // user ที่มีมากกว่า 1 รายการ
  urgentCount: number;       // isUrgent === true
  byCategory: Record<string, number>;
  byEmotion: Record<string, number>;
  repeatedIn15m: number;     // สองข้อความติดกันของ user เดียวกัน ภายใน 15 นาที
};

export function buildStats(logs: LogRow[]): Stats {
  const byUser: Record<string, LogRow[]> = {};
  const byCategory: Record<string, number> = {};
  const byEmotion: Record<string, number> = {};
  let urgentCount = 0;

  for (const l of logs) {
    if (!byUser[l.userId]) byUser[l.userId] = [];
    byUser[l.userId].push(l);

    const c = l.category || "อื่นๆ";
    byCategory[c] = (byCategory[c] || 0) + 1;

    const e = l.emotion || "ไม่ชัดเจน";
    byEmotion[e] = (byEmotion[e] || 0) + 1;

    if (l.isUrgent) urgentCount++;
  }

  // ทักซ้ำใน 15 นาที (นับคู่ที่เกิดจริง)
  let repeatedIn15m = 0;
  for (const userId of Object.keys(byUser)) {
    const arr = byUser[userId].slice().sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (let i = 1; i < arr.length; i++) {
      const prev = new Date(arr[i - 1].timestamp).getTime();
      const cur = new Date(arr[i].timestamp).getTime();
      if (cur - prev <= 15 * 60 * 1000) repeatedIn15m++;
    }
  }

  const uniqueUsers = Object.keys(byUser).length;
  const repeatCustomers = Object.values(byUser).filter((v) => v.length > 1).length;

  return {
    totalMessages: logs.length,
    uniqueUsers,
    repeatCustomers,
    urgentCount,
    byCategory,
    byEmotion,
    repeatedIn15m,
  };
}