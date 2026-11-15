import catalogue from '../../../../resources/data/site-modules.json';
import capabilities from '../../../../resources/data/capabilities.json';
import defaults from '../../../../resources/data/polls.json';
import { array, assetUrl, integer, record, text } from '../../platform/validation';
export const corePollSlug = defaults.core_slug, defaultPollTimezone = defaults.default_timezone;
export function canModule(permissions: readonly string[], module: string): boolean { return permissions.some(permission => permission.startsWith(`${module}.`)); }
export function allowedAdminCards(permissions: readonly string[]) {
  return catalogue.adminSections.filter(section => { const gate = section.gate; return 'capability' in gate ? permissions.includes(gate.capability) : 'module' in gate ? canModule(permissions, gate.module) : Object.keys(capabilities).some(permission => permissions.includes(permission)); });
}
const adminDestinations: Readonly<Record<string, string>> = {
  transit: 'transit_admin', places: 'places_admin', syofficial: 'syofficial_admin', govapps: 'govapps_admin',
  guesswho: 'guesswho_admin', phonebook: 'phonebook_admin', assets: 'assets_admin', site_popup: 'site_popup_admin',
  site_navigation: 'navigation_admin', api_tokens: 'api_tokens_admin',
};
export function dashboardAdminDestination(id: string, permissions: readonly string[]): [section: string, params?: Record<string, string>] | null {
  const destination = adminDestinations[id];
  if (destination) return [destination];
  if (id === 'promises') return ['promises', { view: 'admin' }];
  if (id === 'compass') return ['compass', { view: permissions.includes('compass.stats') ? 'admin-stats' : permissions.includes('compass.figures') ? 'admin-figures' : 'admin-personas' }];
  return null;
}
export function initialDashboardTab(params: Readonly<Record<string, string>>, permissions: readonly string[], canSubmit: boolean): 'profile' | 'submissions' | 'polls' {
  return params.tab === 'profile' ? 'profile' : canModule(permissions, 'polls') ? 'polls' : canSubmit ? 'submissions' : 'profile';
}
export interface ManagedPoll { id: string; title: string; slug: string; active: boolean; count: number }
export interface CandidateGroup { id: string; pollId: string; name: string; order: number; isDefault: boolean; active: boolean }
export interface ManagedCandidate { id: string; groupId: string | null; name: string; title: string; handle: string; image: string | null; status: 'active' | 'archived'; termStart: string; termEnd: string; reason: string; successorId: string | null }
export function decodePoll(value: unknown): ManagedPoll {
  const row = record(value); if (typeof row.is_active !== 'boolean' && row.is_active !== 0 && row.is_active !== 1) throw new Error('حالة الاستبيان غير صالحة.');
  return { id: text(row.id), title: text(row.title), slug: text(row.slug), active: Boolean(row.is_active), count: row.candidates_count == null ? 0 : integer(row.candidates_count) };
}
export function decodePollDetails(value: unknown): { poll: ManagedPoll; groups: CandidateGroup[]; candidates: ManagedCandidate[] } {
  const row = record(value), candidates = array(row.candidates).map((raw): ManagedCandidate => {
    const candidate = record(raw), status = candidate.status ?? 'active'; if (status !== 'active' && status !== 'archived') throw new Error('حالة المرشح غير صالحة.');
    return { id: text(candidate.id), groupId: candidate.candidate_group_id == null ? null : text(candidate.candidate_group_id), name: text(candidate.name), title: text(candidate.title, ''), handle: text(candidate.x_handle, ''), image: assetUrl(candidate.image_url ?? candidate.imageUrl), status,
      termStart: text(candidate.term_started_at, ''), termEnd: text(candidate.term_ended_at, ''), reason: text(candidate.archive_reason, ''), successorId: candidate.successor_id == null ? null : text(candidate.successor_id) };
  });
  return { poll: { ...decodePoll(row.poll), count: candidates.length }, candidates, groups: array(row.groups).map(raw => { const group = record(raw); return { id: text(group.id), pollId: text(group.poll_id), name: text(group.name), order: integer(group.sort_order), isDefault: group.is_default === true || group.is_default === 1, active: group.is_active !== false && group.is_active !== 0 }; }).sort((a, b) => a.order - b.order) };
}
export interface Submission { id: number; cityId: string; routeId: string | null; name: string; nameEn: string; city: string; status: 'pending' | 'approved' | 'rejected'; reason: string; createdAt: string }
function entityId(value: unknown): string { if (typeof value === 'string' && value.length || typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value); throw new Error('معرّف غير صالح.'); }
export function decodeDashboard(value: unknown): { canSubmit: boolean; canManageUsers: boolean; banned: boolean; role: string; submissions: Submission[]; polls: ManagedPoll[] } {
  const row = record(value), auth = record(record(row.auth).user);
  if (row.canManageUsers !== undefined && typeof row.canManageUsers !== 'boolean') throw new Error('صلاحية إدارة المستخدمين غير صالحة.');
  return { canSubmit: row.canSubmitTransit === true, canManageUsers: row.canManageUsers === true, banned: auth.is_banned === true, role: text(row.role), polls: array(row.polls ?? []).map(decodePoll), submissions: array(row.myDrafts ?? []).map(raw => {
    const draft = record(raw), status = draft.status; if (!['pending', 'approved', 'rejected'].includes(String(status))) throw new Error('حالة الاقتراح غير صالحة.');
    return { id: integer(draft.id), cityId: entityId(draft.city_id), routeId: draft.route_id == null ? null : entityId(draft.route_id), name: text(draft.name_ar), nameEn: text(draft.name_en, ''), city: draft.city == null ? entityId(draft.city_id) : text(record(draft.city).name_ar), status: status as Submission['status'], reason: text(draft.rejection_reason, ''), createdAt: text(draft.created_at) };
  }) };
}
export function pollFormErrors(title: string, slug: string, previousSlug?: string): Partial<Record<'title' | 'slug', string>> {
  const errors: Partial<Record<'title' | 'slug', string>> = {};
  if (!title.trim() || title.length > 200) errors.title = 'اكتب عنواناً من ١ إلى ٢٠٠ حرف.';
  if (!slug.trim() || slug.length > 100 || !/^[\p{L}\p{N}_-]+$/u.test(slug)) errors.slug = 'استخدم حروفاً وأرقاماً وشرطات فقط، حتى ١٠٠ حرف.';
  if (previousSlug === corePollSlug && slug !== corePollSlug) errors.slug = 'لا يمكن إعادة تسمية الاستبيان الأساسي.';
  return errors;
}
export function eligibleSuccessors(target: ManagedCandidate, candidates: readonly ManagedCandidate[]): ManagedCandidate[] { return candidates.filter(candidate => candidate.id !== target.id && candidate.status === 'active' && candidate.groupId === target.groupId); }

// PORT STATUS: source resources/js/Pages/Dashboard/Index.tsx and Domain/polls/AdminPollManager.tsx; confidence high; todos 0.
