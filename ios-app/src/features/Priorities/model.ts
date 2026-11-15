import { COMPARISONS, DEPENDENCIES, INITIAL_TOPICS } from '../../../../resources/js/Pages/Priorities/data';
export { COMPARISONS, DEPENDENCIES, INITIAL_TOPICS };
export interface PriorityState { points: Record<string, number>; selected: string[] }
const topicIds = INITIAL_TOPICS.map(topic => topic.id);
const subfiles = INITIAL_TOPICS.flatMap(topic => topic.subFiles.map(sub => ({ ...sub, topic })));
const fail = (): never => { throw new Error('رابط الأولويات غير صالح'); };
export function initialState(): PriorityState { return { points: Object.fromEntries(topicIds.map(id => [id, 0])), selected: [] }; }
export function totalAllocated(state: PriorityState): number { return topicIds.reduce((sum, id) => sum + (state.points[id] ?? 0), 0); }
export function allocate(state: PriorityState, id: string, requested: number): PriorityState {
  if (!topicIds.includes(id) || !Number.isFinite(requested)) return fail();
  const available = 100 - totalAllocated(state) + (state.points[id] ?? 0);
  return { ...state, points: { ...state.points, [id]: Math.max(0, Math.min(available, Math.round(requested))) } };
}
export function toggleSubfile(state: PriorityState, id: string): PriorityState {
  if (!subfiles.some(sub => sub.id === id)) return fail();
  if (state.selected.includes(id)) return { ...state, selected: state.selected.filter(value => value !== id) };
  if (state.selected.length >= 5) throw new Error('خمسة ملفات فرعية كحد أقصى');
  return { ...state, selected: [...state.selected, id] };
}
export function decodeSharedState(encoded: string): PriorityState {
  if (!encoded || encoded.length > 4096) return fail();
  let decoded: string;
  try { decoded = atob(decodeURIComponent(encoded)); } catch { return fail(); }
  const sections = decoded.split('|');
  if (sections.length !== 2) return fail();
  const state = initialState(); const seen = new Set<string>();
  for (const pair of sections[0]?.split(',') ?? []) {
    const [id, points, extra] = pair.split(':');
    if (!id || !topicIds.includes(id) || seen.has(id) || extra !== undefined || !points || !/^\d{1,3}$/.test(points) || Number(points) > 100) return fail();
    seen.add(id); state.points[id] = Number(points);
  }
  if (totalAllocated(state) > 100) return fail();
  state.selected = sections[1] ? sections[1].split(',') : [];
  if (state.selected.length > 5 || new Set(state.selected).size !== state.selected.length || state.selected.some(id => !subfiles.some(sub => sub.id === id))) return fail();
  return state;
}
export function encodeSharedState(state: PriorityState): string {
  const encoded = btoa(`${topicIds.map(id => `${id}:${state.points[id] ?? 0}`).join(',')}|${state.selected.join(',')}`);
  decodeSharedState(encoded);
  return encoded;
}
export interface DependencyAlert { id: string; name: string; topicName: string; missing: string[]; missingNames: string[]; fulfilled: boolean; warning: string }
export function interdependencies(state: PriorityState): { complexity: number; label: string; explanation: string; alerts: DependencyAlert[] } {
  if (state.selected.length === 0) return { complexity: 10, label: 'بسيط جداً', explanation: 'كلما حددت أولويات نوعية، زاد مؤشر تشابك القرارات على الأرض والاعتماد التبادلي للمؤسسات.', alerts: [] };
  let complexity = 10 + state.selected.length * 18;
  const alerts = state.selected.map(id => {
    const sub = subfiles.find(value => value.id === id);
    if (!sub) return fail();
    const dependency = DEPENDENCIES[id];
    if (dependency) complexity += 15;
    const missing = dependency?.requires.filter(required => !state.selected.includes(required)) ?? [];
    return { id, name: sub.name, topicName: sub.topic.name, missing, missingNames: missing.map(requiredId => subfiles.find(candidate => candidate.id === requiredId)?.name ?? requiredId), fulfilled: missing.length === 0, warning: dependency?.warning ?? '' };
  });
  complexity = Math.min(complexity, 100);
  const label = complexity >= 70 ? 'شديد التعقيد والتشابك' : complexity >= 35 ? 'توازن ديناميكي متوسط' : 'سهل ومبسط';
  const explanation = complexity >= 70 ? 'تخطيطك طموح جداً ويحاول حل قضايا سيادية وقانونية واقتصادية متزامنة. ستحتاج الإدارة القادمة لأقوى أجهزة الرقابة والرقمنة لتفادي انهيار المؤسسات.'
    : complexity >= 35 ? 'خطتك ممتازة وتبين فهماً متطوراً لترابط الملفات. توجد بعض العقبات البيروقراطية أو الأمنية التي تتطلب توازناً إضافياً.'
      : 'خطتك بسيطة ومركزة على ملفات محدودة ومستقلة، لكنها قد تهمل مواجهة بعض الجذور المعقدة للمشكلات السيادية.';
  return { complexity, label, explanation, alerts };
}
export const PERSONAS: Record<string, { emoji: string; tag: string; title: string; desc: string }> = {
  justice: { emoji: '⚖️', tag: 'تيار الحقوق والمظالم والتعافي', title: 'حامي دولة القانون والمصالحة المجتمعية', desc: 'أنت تعتقد جازماً أن محاسبة مرتكبي الجرائم وكشف مصير المفقودين وجبر خواطر العائلات هي القاعدة الصلبة والوحيدة لبدء البناء والإعمار دون انتكاسات دموية قادمة.' },
  economy: { emoji: '💼', tag: 'التيار التنموي ومكافحة العوز', title: 'مُحرك عجلة الحياة والاقتصاد الحر', desc: 'رؤيتك ترتكز على حقيقة أن الجوع والبطالة هما مهد الجريمة والفساد والانهيار. ترغب أولاً في توفير سبل العيش الكريم للشباب وتحفيز الاستثمار والشركات لإنعاش سوريا.' },
  housing: { emoji: '🏗️', tag: 'تيار البناء والإنقاذ الخدمي', title: 'باني مرافق سوريا المستقبل ومأوى المهجرين', desc: 'لا عودة للمهجرين واللاجئين في رأيك بلا ترميم فوري، وتجريف للركام، وتنظيم للعشوائيات، وفض للنزاعات العقارية. البناء الخدمي والمنزلي هو المنطلق الحقيقي لبداية الدولة.' },
  security: { emoji: '🛡️', tag: 'تيار الأمن القومي والسيادة المستدامة', title: 'مهندس الأمن وسلطة وهيبة القانون', desc: 'السلاح المنفلت والمخدرات وحقول الألغام هي في نظرك الخطر الأكبر على الوجود والسيادة السورية. تريد مكافحة فوضى التسلح لتمهيد الطريق للمدارس والمصانع والدبلوماسية لتتحرك.' },
  politics: { emoji: '🏛️', tag: 'تيار الإصلاح الديمقراطي والمواطنة', title: 'مخطط الحوكمة الرشيدة والمؤسسات والسيادة', desc: 'أصل البلاء في سوريا بالنسبة لك هو البناء السياسي الاستبدادي. تركز بقوة على تشريع الأحزاب الشفافة وحسم ملف التجنيس الحساس ومنع التزوير في السجلات لبناء مجتمع حر ومتساوٍ.' },
  digital: { emoji: '🌐', tag: 'التيار التقني والتحول الرقمي', title: 'مهندس الأنظمة الذكية وسرعة الخدمة', desc: 'البيروقراطية الورقية والفساد العقاري هما سبب ضياع الدولة في نظرك. تركز على رقمنة السجل المدني، وتأمين السيرفرات السيادية، والخدمات المصرفية الرقمية لتسريع عجلة التعافي الحديث.' }
};
export function persona(state: PriorityState): ({ id: string } & typeof PERSONAS[string]) | null {
  if (totalAllocated(state) < 100) return null;
  const id = [...topicIds].sort((a, b) => (state.points[b] ?? 0) - (state.points[a] ?? 0))[0]!;
  return { id, ...PERSONAS[id]! };
}
export function shareSummary(state: PriorityState): string {
  const profile = persona(state);
  if (!profile) throw new Error('يرجى توزيع النقاط المئة كاملة قبل المشاركة');
  const topics = [...INITIAL_TOPICS].sort((a, b) => (state.points[b.id] ?? 0) - (state.points[a.id] ?? 0));
  return ['🇸🇾 بروفايل أولوياتي التوافقية لمستقبل سوريا ما بعد التحرير 🇸🇾', `لقد قمت بموازنة الـ100 نقطة اهتمام، وحصلت على بروفايل: "${profile.title}"`, '', '💡 ترتيب الأولويات الثلاث الكبرى لدي:',
    ...topics.slice(0, 3).map((topic, index) => `${index + 1}. ${topic.emoji} ${topic.name}: %${state.points[topic.id] ?? 0}`), '', '🎯 الملفات الفرعية الأكثر إلحاحاً في خطتي:',
    ...state.selected.map(id => `- ${subfiles.find(sub => sub.id === id)?.name ?? id}`), '', `📊 مقياس تداخل وتعقيد رؤيتي التخطيطية: ${interdependencies(state).label}`].join('\n');
}
// PORT STATUS: source resources/js/Pages/Priorities/PrioritiesApp.tsx; confidence high; todos 0.
