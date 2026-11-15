import { array, assetUrl, finiteNumber, integer, record, text } from '../../platform/validation';
import { PROMISE_STATE_KEYS, PROMISE_STATUS_KEYS } from '../../../../resources/js/Domain/promises/types';
import { dateOnly, decodePromiseSource, decodePromiseUpdate, decodeSpeakers, promiseNumber, safeSourceUrl } from './model';
import type { AdminPromiseDetail, AdminPromiseRow, AdminReport, AdminSector, AdminSpeaker, EditorForm, EditorOptions, EditorState, ReviewStatus, SourceForm } from './admin-types';
const NONE = '';
let nextKey = 0;
const sourceKey = () => `source-${++nextKey}`;
export const emptySource = (): SourceForm => ({ key: sourceKey(), url: '', outlet: '', type: 'news_article', publishedDate: '', language: 'ar', archiveUrl: '', screenshotUrl: '', videoTimestamp: '', isPrimary: false });
export function initialForm(p: AdminPromiseDetail | null): EditorForm {
    return {
        speaker: p?.speaker ?? null,
        speakerTitle: p?.speakerTitle ?? '',
        coSpeakers: (p?.coSpeakers ?? []).map((cs) => ({
            speaker: cs.speaker ?? null,
            speakerTitle: cs.speakerTitle ?? '',
        })),
        institutionId: p?.institutionId ?? NONE,
        sectorId: p?.sectorId ?? NONE,
        title: p?.title ?? '',
        summary: p?.summary ?? '',
        quote: p?.quote ?? '',
        quoteIsVerbatim: p?.quoteIsVerbatim ?? true,
        statementDate: p?.statementDate ?? '',
        statementVenue: p?.statementVenue ?? 'official_statement',
        deadlineWording: p?.deadlineWording ?? '',
        deadlineDate: p?.deadlineDate ?? '',
        deadlineReasoning: p?.deadlineReasoning ?? '',
        targetValue: p?.targetValue?.toString() ?? '',
        targetUnit: p?.targetUnit ?? '',
        baselineValue: p?.baselineValue?.toString() ?? '',
        baselineNote: p?.baselineNote ?? '',
        isNational: p?.isNational ?? true,
        governorates: p?.governorates ?? [],
        tags: (p?.tags ?? []).join('، '),
        restatesPromiseId: p?.restatesPromiseId ?? NONE,
        relatedPromiseIds: p?.relatedPromiseIds ?? [],
        sources: p && p.sources.length > 0
            ? p.sources.map((s) => ({
                key: sourceKey(),
                url: s.url,
                outlet: s.outlet ?? '',
                type: s.type,
                publishedDate: s.publishedDate ?? '',
                language: s.language ?? 'ar',
                archiveUrl: s.archiveUrl ?? '',
                screenshotUrl: s.screenshotUrl ?? '',
                videoTimestamp: s.videoTimestamp ?? '',
                isPrimary: s.isPrimary,
            }))
            : [{ ...emptySource(), isPrimary: true }],
    };
}

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export function toPayload(form: EditorForm) {
    return {
        speaker_ref: form.speaker?.ref ?? '',
        speaker_title: orNull(form.speakerTitle),
        co_speakers: form.coSpeakers
            .filter((cs) => cs.speaker?.ref)
            .map((cs) => ({
                speaker_ref: cs.speaker!.ref,
                speaker_title: orNull(cs.speakerTitle),
            })),
        institution_id: form.institutionId === NONE ? null : form.institutionId,
        sector_id: form.sectorId === NONE ? null : form.sectorId,
        title: form.title.trim(),
        summary: orNull(form.summary),
        quote: form.quote.trim(),
        quote_is_verbatim: form.quoteIsVerbatim,
        statement_date: form.statementDate,
        statement_venue: form.statementVenue,
        deadline_wording: orNull(form.deadlineWording),
        deadline_date: orNull(form.deadlineDate),
        deadline_reasoning: orNull(form.deadlineReasoning),
        target_value: numOrNull(form.targetValue),
        target_unit: orNull(form.targetUnit),
        baseline_value: numOrNull(form.baselineValue),
        baseline_note: orNull(form.baselineNote),
        is_national: form.isNational,
        governorates: form.isNational ? [] : form.governorates,
        tags: form.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
        restates_promise_id: form.restatesPromiseId === NONE ? null : form.restatesPromiseId,
        related_promise_ids: form.relatedPromiseIds,
        sources: form.sources.map((s) => ({
            url: s.url.trim(),
            outlet: orNull(s.outlet),
            type: s.type,
            published_date: orNull(s.publishedDate),
            language: s.language || null,
            archive_url: orNull(s.archiveUrl),
            screenshot_url: orNull(s.screenshotUrl),
            video_timestamp: orNull(s.videoTimestamp),
            is_primary: s.isPrimary,
        })),
    };
}

export function fingerprint(form: EditorForm): string { return JSON.stringify({ ...form, sources: form.sources.map(({ key, ...source }) => { void key; return source; }) }); }
export function createEditor(promise: AdminPromiseDetail | null): EditorState { const form = initialForm(promise); return { promise, form, formVersion: promise?.version ?? 0, saved: fingerprint(form) }; }
export const editorDirty = (state: EditorState): boolean => fingerprint(state.form) !== state.saved;
export function adoptEditor(state: EditorState, promise: AdminPromiseDetail, action: 'save' | 'status' | 'unpublish' | 'publish' | 'reject'): EditorState { return action === 'status' || action === 'unpublish' ? { ...state, promise } : createEditor(promise); }
export function editorPayload(state: EditorState) { return { ...toPayload(state.form), ...(state.promise ? { version: state.formVersion } : {}) }; }
export function undoableStatusId(promise: AdminPromiseDetail): number | null { return promise.publishedAt === null ? [...promise.updates].reverse().find(update => update.type === 'status_change')?.id ?? null : null; }
export function reorderSectors(ids: readonly string[], index: number, delta: -1 | 1): string[] { const next = [...ids], target = index + delta; if (!Number.isInteger(index) || index < 0 || index >= next.length || target < 0 || target >= next.length) return next; [next[index], next[target]] = [next[target]!, next[index]!]; return next; }
export function validateEditor(form: EditorForm, earliest: string, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const bounded = (key: string, value: string, max: number, required = false) => { if ((required && !value.trim()) || value.length > max) errors[key] = required && !value.trim() ? 'هذا الحقل مطلوب' : `الحد الأقصى ${max} حرفاً`; };
  bounded('title', form.title, 200, true); bounded('quote', form.quote, 5000, true); bounded('summary', form.summary, 2000);
  if (!form.speaker?.ref) errors.speaker_ref = 'اختر المسؤول صاحب الوعد';
  if (form.coSpeakers.length > 5) errors.co_speakers = 'خمسة متحدثين إضافيين كحد أقصى';
  try { dateOnly(form.statementDate); if (form.statementDate < earliest || form.statementDate > today) throw new Error(); } catch { errors.statement_date = 'حدد تاريخ تصريح صحيحاً ضمن الفترة المتاحة'; }
  if (form.deadlineDate) try { dateOnly(form.deadlineDate); if (form.deadlineDate < form.statementDate) throw new Error(); } catch { errors.deadline_date = 'الموعد لا يسبق تاريخ التصريح'; }
  for (const [key, value] of [['target_value', form.targetValue], ['baseline_value', form.baselineValue]] as const) if (value.trim() && (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > 999_999_999_999)) errors[key] = 'أدخل قيمة رقمية ضمن حدود المصدر';
  if (form.targetValue.trim() && !form.targetUnit.trim()) errors.target_unit = 'حدد وحدة الهدف';
  const tags = form.tags.split(/[،,]/).map(tag => tag.trim()).filter(Boolean); if (tags.length > 10 || tags.some(tag => tag.length > 64)) errors.tags = 'عشر وسوم كحد أقصى،64 حرفاً للوسم';
  if (!form.sources.length || form.sources.length > 20) errors.sources = 'أضف مصدراً واحداً إلى20 مصدراً';
  form.sources.forEach((source, index) => { try { safeSourceUrl(source.url); } catch { errors[`sources.${index}.url`] = 'أدخل رابط مصدر HTTP أوHTTPS صحيحاً'; } if (source.archiveUrl) try { safeSourceUrl(source.archiveUrl); } catch { errors[`sources.${index}.archive_url`] = 'رابط الأرشيف غير صالح'; } if (source.publishedDate) try { dateOnly(source.publishedDate); } catch { errors[`sources.${index}.published_date`] = 'تاريخ نشر غير صالح'; } if (source.videoTimestamp && !/^\d{1,2}(:\d{2}){1,2}$/.test(source.videoTimestamp)) errors[`sources.${index}.video_timestamp`] = 'اكتب الوقت بصيغة12:34 أو1:02:03'; });
  return errors;
}

function identity(value: unknown): string { const result = text(value); if (!result || result.length > 128 || !/^[a-zA-Z0-9:_-]+$/.test(result)) throw new Error('معرّف غير صالح'); return result; }
export function uuid(value: unknown): string { const result = text(value); if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(result)) throw new Error('معرّف الوعد غير صالح'); return result; }
const optionalText = (value: unknown) => value == null ? null : text(value);
const optionalDate = (value: unknown) => value == null ? null : dateOnly(value);
const optionalNumber = (value: unknown) => value == null ? null : finiteNumber(value);
const count = (value: unknown) => { const result = integer(value); if (result < 0) throw new Error('عدد غير صالح'); return result; };
const boolean = (value: unknown) => { if (typeof value !== 'boolean') throw new Error('قيمة منطقية غير صالحة'); return value; };
const status = (value: unknown) => { if (!PROMISE_STATUS_KEYS.includes(value as typeof PROMISE_STATUS_KEYS[number])) throw new Error('حالة غير صالحة'); return value as typeof PROMISE_STATUS_KEYS[number]; };
const state = (value: unknown) => { if (!PROMISE_STATE_KEYS.includes(value as typeof PROMISE_STATE_KEYS[number])) throw new Error('حالة غير صالحة'); return value as typeof PROMISE_STATE_KEYS[number]; };
const reviewStatus = (value: unknown): ReviewStatus => { if (!['pending', 'published', 'rejected'].includes(text(value))) throw new Error('حالة مراجعة غير صالحة'); return value as ReviewStatus; };
const optionalUrl = (value: unknown) => value == null || value === '' ? null : safeSourceUrl(value);
function promiseLink(value: unknown): { id: string; number: number | null; title: string } { const raw = record(value); return { id: uuid(raw.id), number: raw.number == null ? null : promiseNumber(raw.number), title: text(raw.title) }; }
export function decodeAdminRow(value: unknown): AdminPromiseRow {
  const raw = record(value); return { ...promiseLink(raw), speakerName: optionalText(raw.speakerName), speakerPending: boolean(raw.speakerPending), status: status(raw.status), state: state(raw.state), reviewStatus: reviewStatus(raw.reviewStatus), origin: text(raw.origin), statementDate: optionalDate(raw.statementDate), deadlineDate: optionalDate(raw.deadlineDate), sourcesCount: count(raw.sourcesCount), pendingReportsCount: count(raw.pendingReportsCount), submitterName: optionalText(raw.submitterName), submitterNote: optionalText(raw.submitterNote), rejectionReason: optionalText(raw.rejectionReason), updatedAt: optionalText(raw.updatedAt) };
}
export function decodeAdminDetail(value: unknown): AdminPromiseDetail {
  const raw = record(value); const speaker = (input: unknown) => input == null ? null : decodeSpeakers({ speakers: [input] })[0]!;
  return { ...promiseLink(raw), summary: optionalText(raw.summary), quote: text(raw.quote), quoteIsVerbatim: boolean(raw.quoteIsVerbatim), speaker: speaker(raw.speaker), speakerTitle: optionalText(raw.speakerTitle), coSpeakers: array(raw.coSpeakers ?? []).map(input => { const row = record(input); return { speaker: speaker(row.speaker), speakerTitle: optionalText(row.speakerTitle) }; }), institutionId: raw.institutionId == null ? null : identity(raw.institutionId), sectorId: raw.sectorId == null ? null : identity(raw.sectorId), isNational: boolean(raw.isNational), governorates: array(raw.governorates).map(identity), tags: array(raw.tags).map(input => text(input)), statementDate: optionalDate(raw.statementDate), statementVenue: text(raw.statementVenue), deadlineWording: optionalText(raw.deadlineWording), deadlineDate: optionalDate(raw.deadlineDate), deadlineReasoning: optionalText(raw.deadlineReasoning), targetValue: optionalNumber(raw.targetValue), targetUnit: optionalText(raw.targetUnit), baselineValue: optionalNumber(raw.baselineValue), baselineNote: optionalText(raw.baselineNote), restatesPromiseId: raw.restatesPromiseId == null ? null : uuid(raw.restatesPromiseId), restates: raw.restates == null ? null : promiseLink(raw.restates), relatedPromiseIds: array(raw.relatedPromiseIds ?? []).map(uuid), status: status(raw.status), state: state(raw.state), resolvedAt: optionalDate(raw.resolvedAt), reviewStatus: reviewStatus(raw.reviewStatus), publishedAt: optionalText(raw.publishedAt), origin: text(raw.origin), submitterName: optionalText(raw.submitterName), submitterNote: optionalText(raw.submitterNote), rejectionReason: optionalText(raw.rejectionReason), sources: array(raw.sources).map(decodePromiseSource), updates: array(raw.updates).map(decodePromiseUpdate), originalDeadlineDate: optionalDate(raw.originalDeadlineDate), originalDeadlineWording: optionalText(raw.originalDeadlineWording), postponedCount: count(raw.postponedCount ?? 0), version: count(raw.version) };
}
export function decodeEditorPage(value: unknown): { promise: AdminPromiseDetail | null; options: EditorOptions; queueCount: number } {
  const raw = record(value), options = record(raw.options);
  return { promise: raw.promise == null ? null : decodeAdminDetail(raw.promise), queueCount: count(raw.queueCount), options: { sectors: array(options.sectors).map(input => { const row = record(input); return { id: identity(row.id), label: text(row.label), icon: optionalText(row.icon) }; }), governorates: array(options.governorates).map(input => { const row = record(input); return { id: identity(row.id), label: text(row.label) }; }), institutions: array(options.institutions).map(input => { const row = record(input); return { id: identity(row.id), name: text(row.name) }; }), venues: array(options.venues).map(input => text(input)), sourceTypes: array(options.sourceTypes).map(input => text(input)), statuses: array(options.statuses).map(status), earliestDate: dateOnly(options.earliestDate), today: dateOnly(options.today), restatable: array(options.restatable).map(input => { const row = promiseLink(input); if (row.number === null) throw new Error('رقم الوعد غير صالح'); return { ...row, number: row.number }; }) } };
}
export function decodeAdminIndex(value: unknown) { const raw = record(value); return { promises: array(raw.promises).map(decodeAdminRow), queueCount: count(raw.queueCount) }; }
export function decodeAdminSpeaker(value: unknown): AdminSpeaker {
  const raw = record(value), speakerStatus = text(raw.status), link = optionalText(raw.link);
  if (!['approved', 'pending', 'rejected'].includes(speakerStatus) || (link !== null && !['candidate', 'official', 'house'].includes(link))) throw new Error('حالة مسؤول غير صالحة');
  return { id: uuid(raw.id), name: text(raw.name), title: optionalText(raw.title), image: assetUrl(raw.image), xHandle: optionalText(raw.xHandle), imageUrl: assetUrl(raw.imageUrl), institutionId: raw.institutionId == null ? null : identity(raw.institutionId), institutionName: optionalText(raw.institutionName), status: speakerStatus as AdminSpeaker['status'], link: link as AdminSpeaker['link'], promisesCount: count(raw.promisesCount), rejectionReason: optionalText(raw.rejectionReason) };
}
export function decodeSpeakersPage(value: unknown) { const raw = record(value); return { speakers: array(raw.speakers).map(decodeAdminSpeaker), institutions: array(raw.institutions).map(input => { const row = record(input); return { id: identity(row.id), name: text(row.name) }; }), queueCount: count(raw.queueCount) }; }
export function decodeSectorsPage(value: unknown): { sectors: AdminSector[]; queueCount: number } { const raw = record(value); return { sectors: array(raw.sectors).map(input => { const row = record(input); return { id: identity(row.id), label: text(row.label), icon: optionalText(row.icon), isActive: boolean(row.isActive), promisesCount: count(row.promisesCount) }; }), queueCount: count(raw.queueCount) }; }
export function decodeReviewPage(value: unknown): { promises: AdminPromiseRow[]; speakers: AdminSpeaker[]; reports: AdminReport[]; queueCount: number } {
  const raw = record(value); return { ...decodeAdminIndex(raw), speakers: array(raw.speakers).map(decodeAdminSpeaker), reports: array(raw.reports).map(input => { const row = record(input), kind = text(row.kind); if (kind !== 'progress' && kind !== 'error') throw new Error('نوع بلاغ غير صالح'); return { id: count(row.id), kind, body: text(row.body), sourceUrl: optionalUrl(row.sourceUrl), createdOn: optionalDate(row.createdOn), userName: optionalText(row.userName), promise: promiseLink(row.promise) }; }) };
}
export const REVIEW_LABEL = { pending: 'بانتظار النشر', published: 'منشور', rejected: 'مرفوض' };
export function sectorPayload(form: { id: string; label: string; icon: string }, creating: boolean) {
  if (!form.label.trim() || form.label.length > 255) throw new Error('أدخل اسم قطاع،255 حرفاً كحد أقصى');
  if (creating && !/^[a-z][a-z0-9_-]{0,31}$/.test(form.id)) throw new Error('المعرّف يبدأ بحرف لاتيني صغير، ويحتوي حروفاً وأرقاماً وشرطة فقط');
  if (form.icon.length > 64) throw new Error('رمز القطاع غير صالح');
  return { ...(creating ? { id: form.id } : {}), label: form.label.trim(), icon: form.icon || null };
}
export function speakerPayload(form: { name: string; title: string; institutionId: string; imageUrl: string; xHandle: string }) {
  if (!form.name.trim() || form.name.length > 255 || form.title.length > 255) throw new Error('أدخل اسم المسؤول ومنصبه،255 حرفاً كحد أقصى');
  if (form.xHandle && !/^@?[a-zA-Z0-9_]{1,15}$/.test(form.xHandle)) throw new Error('أدخل اسم حسابX دون رابط');
  return { name: form.name.trim(), title: form.title.trim() || null, institution_id: form.institutionId || null, image_url: assetUrl(form.imageUrl), x_handle: form.xHandle.trim() || null };
}
// PORT STATUS: source Admin/Promises/Edit.tsx, _lib/types.ts and PromisePresenter.php; confidence high; todos 0.

