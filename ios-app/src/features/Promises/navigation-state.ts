let sequence = 0;
const visits = new Map<string, { number: number; url: string }>();
export function rememberListVisit(number: number, url: string): string { if (!/^\/promises(?:\?[^#]*)?$/.test(url)) throw new Error('مسار العودة غير صالح'); const token = String(++sequence); visits.set(token, { number, url }); if (visits.size > 100) visits.delete(visits.keys().next().value ?? ''); return token; }
export function canReturnToList(token: string | undefined, number: number, url: string): boolean { const visit = token ? visits.get(token) : null; return visit?.number === number && visit.url === url; }
// PORT NOTE: Native history keeps local free-text and scroll only for the exact originating stack entry, matching the source's remembered-list contract.
// PORT STATUS: source resources/js/Pages/Promises/_lib/filters.ts; confidence high; todos 0.
