export const milestones = [{ level: 1, points: 0 }, { level: 2, points: 15 }, { level: 3, points: 75 }, { level: 4, points: 250 }, { level: 5, points: 500 }, { level: 6, points: 1500 }, { level: 7, points: 5000 }, { level: 8, points: 15000 }, { level: 9, points: 50000 }, { level: 10, points: 100000 }];
const names = ['مبتدئ', 'جوّال', 'مستطلع', 'مستكشف', 'مرشد محلي', 'مرشد خبير', 'رحّالة', 'رائد السياحة', 'سفير السياحة', 'وزير السياحة'];
export function rankName(level: number): string { return names[Math.min(Math.max(Math.trunc(level), 1), 10) - 1] ?? names[0]!; }
export function nextRank(points: number): { level: number; points: number } | null { return milestones.find(row => row.points > points) ?? null; }
