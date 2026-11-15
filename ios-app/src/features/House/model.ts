import { MEMBERS_2026, OMran_SOURCE_URL, type Member2026 } from '../../../../resources/js/Pages/House/members2026';
import governorates from '../../../../resources/data/governorates.json';
import { normalizeSearch } from '../../domain';
import { array, record, text } from '../../platform/validation';
export { OMran_SOURCE_URL, type Member2026 };
export type Dimension = 'governorate' | 'gender' | 'selection' | 'age' | 'social';
export type ArchiveMode = 'voters' | 'candidates' | 'winners' | 'presidential';
export type ArchiveRow = Record<string, string>;
export const AGE_LABEL: Record<string, string> = { lt30: 'أقل من30', '30s': '30-39', '40s': '40-49', '50s': '50-59', '60p': '60+', 'غير محدد': 'غير محدد' };
export const SOCIAL_LABEL: Record<string, string> = { has_social: 'لديه حساب', no_social: 'بدون حساب' };
export const STATUS_LABEL: Record<string, string> = { active: 'نشط', resigned: 'مستقيل', dead: 'متوفى', inactive: 'غير نشط' };
const fields = ['name_ar', 'governorate_ar', 'district', 'town', 'gender', 'birth_year', 'age', 'selection_method', 'category', 'status', 'member_number', 'management_position', 'facebook_url', 'twitter_url'] as const;
export function decodeHousePage(payload: unknown): Member2026[] {
  const rows = array(record(payload).members2026 ?? []);
  return rows.map(entry => {
    const source = record(entry); const member = Object.fromEntries(fields.map(field => [field, text(source[field], '')])) as unknown as Member2026;
    if (!member.name_ar.trim() || !member.governorate_ar.trim()) throw new Error('بيانات عضو المجلس غير صالحة');
    return member;
  });
}
export function mergeRoster(members: Member2026[]): Member2026[] {
  if (!members.length) return MEMBERS_2026;
  const source = new Map(MEMBERS_2026.map(member => [member.name_ar.trim(), member]));
  return members.map(member => {
    if (member.facebook_url || member.twitter_url) return member;
    const fallback = source.get(member.name_ar.trim());
    return fallback ? { ...member, facebook_url: member.facebook_url || fallback.facebook_url || null, twitter_url: member.twitter_url || fallback.twitter_url || null } : member;
  });
}
export function ageGroupOf(member: { birth_year: string }, year = new Date().getFullYear()): string {
  const born = Number.parseInt(member.birth_year, 10); if (!born || born < 1900 || born > 2100) return 'غير محدد';
  return ageGroup(year - born);
}
function ageGroup(age: number): string { return age < 30 ? 'lt30' : age < 40 ? '30s' : age < 50 ? '40s' : age < 60 ? '50s' : '60p'; }
export function groupKey(member: Member2026, dimension: Dimension): string {
  if (dimension === 'gender') return member.gender === 'F' ? 'F' : 'M';
  if (dimension === 'selection') return member.selection_method || 'غير محدد';
  if (dimension === 'age') return ageGroupOf(member);
  if (dimension === 'social') return member.facebook_url?.trim() || member.twitter_url?.trim() ? 'has_social' : 'no_social';
  return member.governorate_ar || 'غير محدد';
}
export function groupLabel(key: string, dimension: Dimension): string { return dimension === 'gender' ? key === 'F' ? 'إناث' : 'ذكور' : dimension === 'age' ? AGE_LABEL[key] ?? key : dimension === 'social' ? SOCIAL_LABEL[key] ?? key : key; }
export function seatPoints(count: number): { x: number; y: number }[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('عدد المقاعد غير صالح');
  if (!count) return [];
  const rows = Math.min(7, count); const radii = Array.from({ length: rows }, (_, row) => 72 + (106 * (row + 1)) / rows);
  const total = radii.reduce((sum, radius) => sum + radius, 0); const capacity = radii.map(radius => Math.max(1, Math.round(count * radius / total)));
  let difference = count - capacity.reduce((sum, value) => sum + value, 0); let index = rows - 1;
  while (difference) { const current = (index + rows) % rows; const value = capacity[current]!; if (difference > 0 || value > 1) { capacity[current] = value + Math.sign(difference); difference -= Math.sign(difference); } index = (current - 1 + rows) % rows; }
  return capacity.flatMap((size, row) => Array.from({ length: size }, (_, slot) => { const theta = Math.PI * (1 - (slot + 0.5) / size); return { x: 200 + radii[row]! * Math.cos(theta), y: 188 - radii[row]! * Math.sin(theta) }; }));
}
export const HOUSE_SHEET_ID = '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc';
const tabs = [['all', '125118455'], ['qunaitra', '522040139'], ['idlib', '0'], ['hama', '694979899'], ['damascus', '1923715976'], ['rif-damascus', '1677791143'], ['daraa', '1028853845'], ['latakia', '638432279'], ['tartus', '1926010966'], ['homs', '252895295'], ['aleppo', '1121899715'], ['deir-ez-zor', '1166128088'], ['raqqa', '137630647'], ['hasakah', '2031427715']] as const;
export const PROVINCES = tabs.map(([key, gid]) => ({ key, gid, label: key === 'all' ? 'الكل' : governorates.find(row => row.id === key || row.aliases.includes(key))?.name_ar ?? key }));
export function archiveUrl(mode: ArchiveMode, province = 'damascus'): string {
  const gid = mode === 'winners' ? '385944900' : mode === 'candidates' ? '109132918' : mode === 'presidential' ? '1851445664' : PROVINCES.find(row => row.key === province)?.gid;
  if (gid == null) throw new Error('المحافظة غير صالحة');
  return `https://docs.google.com/spreadsheets/d/${HOUSE_SHEET_ID}/export?format=csv&gid=${gid}`;
}
// PORT NOTE: Parse full quoted CSV records so embedded newlines remain one source field.
export function parseHouseCSV(csv: string, year = new Date().getFullYear()): { rows: ArchiveRow[]; headers: string[] } {
  if (csv.length > 8_000_000 || /<!doctype|<html/i.test(csv)) throw new Error('أعاد المصدر صفحة غير صالحة بدلاً من بيانات المجلس');
  const records: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(cell.trim()); cell = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && csv[i + 1] === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) records.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('ملف بيانات المجلس غير مكتمل');
  row.push(cell.trim()); if (row.some(Boolean)) records.push(row);
  const headers = (records.shift() ?? []).map(header => header.replace(/^\uFEFF/, '').trim());
  if (!headers.some(header => ['Name', 'الاسم', 'name'].includes(header))) throw new Error('تغيّرت أعمدة المصدر. تعذّر التحقق من الأسماء');
  const number = (value: string | undefined) => Number(value?.match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.')) || 0;
  const rows = records.map(values => {
    const item: ArchiveRow = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const sex = normalizeSearch(item.Sex || item['الجنس'] || '');
    let age = number(item.Age || item['العمر'] || item['السن']);
    if (!age || age < 0 || age > 120) { const birth = number(item.BirthYear || item['سنة الميلاد'] || item['سنة_الميلاد']); if (birth > 1900 && birth < 2100) age = Math.max(0, Math.min(120, year - Math.round(birth))); }
    return { ...item, Age: String(age), __nameNorm: normalizeSearch(item.Name || item['الاسم'] || item.name || ''), __placeNorm: normalizeSearch(item.Place || item['المكان'] || ''), __sexNorm: sex === 'ذكر' ? 'ذكر' : ['انثى', 'انثي'].includes(sex) ? 'أنثى' : '', __ageGroup: ageGroup(age), __appealStatus: (item['حالة الطعن'] || item.AppealStatus || '').trim() };
  }).filter(item => item.__nameNorm || item.__placeNorm);
  return { rows, headers: [...headers, ...(!headers.includes('Age') ? ['Age'] : [])] };
}

export function hemicycleSeats(members: Member2026[], dimension: Dimension): { x: number; y: number; group: string; member: Member2026 }[] {
  const count = members.length; if (!count) return [];
  const rows = Math.min(7, count); const radii = Array.from({ length: rows }, (_, row) => 72 + (106 * (row + 1)) / rows);
  const radiusTotal = radii.reduce((a, b) => a + b, 0); const capacities = radii.map(radius => Math.max(1, Math.round(count * radius / radiusTotal)));
  let difference = count - capacities.reduce((a, b) => a + b, 0); let rowIndex = rows - 1;
  while (difference) { const current = (rowIndex + rows) % rows; if (difference > 0 || capacities[current]! > 1) { capacities[current] = capacities[current]! + Math.sign(difference); difference -= Math.sign(difference); } rowIndex = (current - 1 + rows) % rows; }
  const grouped = new Map<string, Member2026[]>();
  members.forEach(member => { const key = groupKey(member, dimension); grouped.set(key, [...(grouped.get(key) ?? []), member]); });
  const order = [...grouped.keys()].sort((a, b) => grouped.get(b)!.length - grouped.get(a)!.length);
  const taken = new Map(order.map(key => [key, 0])); const result: { x: number; y: number; group: string; member: Member2026 }[] = [];
  capacities.forEach((capacity, row) => {
    const shares = order.map(key => { const exact = grouped.get(key)!.length * capacity / count; return { key, amount: Math.floor(exact), fraction: exact - Math.floor(exact) }; }).sort((a, b) => b.fraction - a.fraction);
    let left = capacity - shares.reduce((sum, share) => sum + share.amount, 0);
    for (const share of shares) { if (left > 0) { share.amount += 1; left -= 1; } }
    shares.forEach(share => { const available = grouped.get(share.key)!.length - taken.get(share.key)!; if (share.amount > available) { left += share.amount - available; share.amount = available; } });
    while (left > 0) { const available = shares.find(share => share.amount < grouped.get(share.key)!.length - taken.get(share.key)!); if (!available) throw new Error('تعذّر توزيع مقاعد المجلس'); available.amount += 1; left -= 1; }
    const allocation = new Map(shares.map(share => [share.key, share.amount])); let slot = 0;
    [...order].reverse().forEach(key => {
      for (let index = 0; index < allocation.get(key)!; index += 1) { const angle = Math.PI * (1 - (slot + 0.5) / capacity); const current = taken.get(key)!; const member = grouped.get(key)![current]!; taken.set(key, current + 1); slot += 1; result.push({ x: 200 + radii[row]! * Math.cos(angle), y: 188 - radii[row]! * Math.sin(angle), group: key, member }); }
    });
  });
  return result;
}
// PORT STATUS: source resources/js/Pages/House/data.ts and ParliamentChart2026.tsx; confidence high; todos 0.
