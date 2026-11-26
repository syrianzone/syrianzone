import { useMemo, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import SortableList, { type SortableListItem } from '@/Components/directory/SortableList';
import {
    ArrowRight,
    ExternalLink,
    FileText,
    History,
    ImageUp,
    Link2,
    Loader2,
    Pencil,
    Plus,
    Save,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { useCan } from '@/Lib/useCan';
import { useTabList } from '@/Lib/useTabList';
import { cn } from '@/Lib/utils';
import { govtCvsApi } from '@/Domain/govtcvs/api';
import OfficialAvatar from '@/Domain/govtcvs/OfficialAvatar';
import {
    CvCompletenessBadge,
    OfficeStatusBadge,
    PhaseBadge,
    PublishStatusBadge,
    TierBadge,
} from '@/Domain/govtcvs/StatusBadges';
import {
    ALIAS_TYPE_LABELS,
    CV_COMPLETENESS_META,
    CV_SECTION_LABELS,
    CV_SECTION_META,
    DATE_PRECISION_LABELS,
    END_REASON_META,
    EVIDENCE_TYPE_META,
    formatGovtDate,
    OFFICE_STATUS_META,
    PHASE_META,
    PUBLISH_STATUS_META,
    safeHref,
    TENURE_STATUS_META,
    TIER_META,
    VERIFICATION_LEVEL_META,
} from '@/Domain/govtcvs/constants';
import {
    GOVT_ALIAS_TYPE_KEYS,
    GOVT_CV_SECTION_KEYS,
    GOVT_DATE_PRECISION_KEYS,
    type GovtAliasItem,
    type GovtCvEntryItem,
    type GovtEvidenceItem,
    type GovtOfficeSlotItem,
    type GovtOfficialDetail,
    type GovtTenureItem,
    type InstitutionOption,
} from '@/Domain/govtcvs/types';
import AdminHeader from './_components/AdminHeader';

const NONE = '__none';

const EDITOR_TAB_IDS = ['identity', 'tenures', 'cv', 'evidence'] as const;
type EditorTabId = (typeof EDITOR_TAB_IDS)[number];

interface CrossLinkOption {
    id: string | number;
    name?: string;
    name_ar?: string;
    label?: string;
}

interface Props {
    official: GovtOfficialDetail | null;
    institutions?: InstitutionOption[];
    slots?: GovtOfficeSlotItem[];
    options?: {
        institutions?: InstitutionOption[];
        slots?: GovtOfficeSlotItem[];
        candidates?: CrossLinkOption[];
        promise_speakers?: CrossLinkOption[];
        official_entities?: CrossLinkOption[];
        house_members?: CrossLinkOption[];
    };
}

interface IdentityFormState {
    slug: string;
    full_name_ar: string;
    display_name_ar: string;
    full_name_en: string;
    honorific_ar: string;
    office_status: string;
    highest_tier: string;
    birth_year: string;
    birth_place_ar: string;
    gender: string;
    languages: string;
    bio_summary_ar: string;
    portrait_url: string;
    cv_completeness: string;
    publish_status: string;
    verification_level: string;
    official_entity_id: string;
    candidate_id: string;
    promise_speaker_id: string;
    house_member_id: string;
    aliases: GovtAliasItem[];
}

function toIdentityForm(o: GovtOfficialDetail | null): IdentityFormState {
    return {
        slug: o?.slug ?? '',
        full_name_ar: o?.full_name_ar ?? '',
        display_name_ar: o?.display_name_ar ?? '',
        full_name_en: o?.full_name_en ?? '',
        honorific_ar: o?.honorific_ar ?? '',
        office_status: o?.office_status ?? 'in_office',
        highest_tier: o?.highest_tier ?? 'minister',
        birth_year: o?.birth_year ? String(o.birth_year) : '',
        birth_place_ar: o?.birth_place_ar ?? '',
        gender: o?.gender || NONE,
        languages: (o?.languages ?? []).join('، '),
        bio_summary_ar: o?.bio_summary_ar ?? '',
        portrait_url: o?.portrait_url ?? '',
        cv_completeness: o?.cv_completeness ?? 'positions_only',
        publish_status: o?.publish_status ?? 'draft',
        verification_level: o?.verification_level ?? 'editorial',
        official_entity_id: o?.official_entity_id ?? '',
        candidate_id: o?.candidate_id ?? '',
        promise_speaker_id: o?.promise_speaker_id ?? '',
        house_member_id: o?.house_member_id ? String(o.house_member_id) : '',
        aliases: (o?.aliases ?? []).map((a) => ({
            id: a.id,
            alias_ar: a.alias_ar,
            alias_type: a.alias_type || 'patronymic_short',
            source_note: a.source_note ?? '',
        })),
    };
}

interface TenureFormState {
    office_slot_id: string;
    role_title_ar: string;
    institution_id: string;
    institution_name_ar: string;
    tier: string;
    government_phase: string;
    status: string;
    started_at: string;
    start_date_precision: string;
    start_decree_ref: string;
    ended_at: string;
    end_date_precision: string;
    end_reason: string;
    end_decree_ref: string;
    is_acting: boolean;
    auto_close_incumbent: boolean;
    notes_ar: string;
}

function emptyTenureForm(): TenureFormState {
    return {
        office_slot_id: NONE,
        role_title_ar: '',
        institution_id: NONE,
        institution_name_ar: '',
        tier: 'minister',
        government_phase: 'transitional_2025',
        status: 'current',
        started_at: '',
        start_date_precision: 'exact',
        start_decree_ref: '',
        ended_at: '',
        end_date_precision: NONE,
        end_reason: NONE,
        end_decree_ref: '',
        is_acting: false,
        auto_close_incumbent: true,
        notes_ar: '',
    };
}

function tenureToForm(t: GovtTenureItem): TenureFormState {
    return {
        office_slot_id: t.office_slot_id ?? NONE,
        role_title_ar: t.role_title_ar ?? '',
        institution_id: t.institution_id ?? NONE,
        institution_name_ar: t.institution_name_ar ?? '',
        tier: t.tier || 'minister',
        government_phase: t.government_phase || 'transitional_2025',
        status: t.status || 'current',
        started_at: t.started_at ?? '',
        start_date_precision: t.start_date_precision || 'exact',
        start_decree_ref: t.start_decree_ref ?? '',
        ended_at: t.ended_at ?? '',
        end_date_precision: t.end_date_precision ?? NONE,
        end_reason: t.end_reason ?? NONE,
        end_decree_ref: t.end_decree_ref ?? '',
        is_acting: t.is_acting ?? false,
        auto_close_incumbent: false,
        notes_ar: t.notes_ar ?? '',
    };
}

interface CvEntryFormState {
    section: string;
    title_ar: string;
    organization_ar: string;
    location_ar: string;
    start_year: string;
    end_year: string;
    is_ongoing: boolean;
    details_ar: string;
}

function emptyCvEntryForm(): CvEntryFormState {
    return {
        section: 'education',
        title_ar: '',
        organization_ar: '',
        location_ar: '',
        start_year: '',
        end_year: '',
        is_ongoing: false,
        details_ar: '',
    };
}

function cvEntryToForm(entry: GovtCvEntryItem): CvEntryFormState {
    return {
        section: entry.section || 'education',
        title_ar: entry.title_ar ?? '',
        organization_ar: entry.organization_ar ?? '',
        location_ar: entry.location_ar ?? '',
        start_year: entry.start_year ? String(entry.start_year) : '',
        end_year: entry.end_year ? String(entry.end_year) : '',
        is_ongoing: entry.is_ongoing ?? false,
        details_ar: entry.details_ar ?? '',
    };
}

interface EvidenceFormState {
    evidence_type: string;
    tenure_id: string;
    source_title_ar: string;
    source_channel_ar: string;
    source_url: string;
    published_date: string;
    excerpt_ar: string;
}

function emptyEvidenceForm(): EvidenceFormState {
    return {
        evidence_type: 'appointment_decree',
        tenure_id: NONE,
        source_title_ar: '',
        source_channel_ar: '',
        source_url: '',
        published_date: '',
        excerpt_ar: '',
    };
}

const orNull = (v: string) => (v.trim() === '' || v === NONE ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export default function GovtCvsAdminEdit({
    official: initialOfficial,
    institutions: propInstitutions,
    slots: propSlots,
    options,
}: Props) {
    const can = useCan() as (cap: string) => boolean;
    const canCreate = can('govtcvs.create');
    const canEdit = can('govtcvs.edit');
    const canPublish = can('govtcvs.publish');
    const canSaveIdentity = initialOfficial ? canEdit : canCreate;

    const institutions = useMemo(
        () => propInstitutions ?? options?.institutions ?? [],
        [propInstitutions, options?.institutions],
    );
    const slots = useMemo(
        () => propSlots ?? options?.slots ?? [],
        [propSlots, options?.slots],
    );

    const [official, setOfficial] = useState<GovtOfficialDetail | null>(initialOfficial);
    const [activeTab, setActiveTab] = useState<EditorTabId>('identity');
    const tabs = useTabList({
        ids: EDITOR_TAB_IDS,
        active: activeTab,
        onChange: setActiveTab,
        dir: 'rtl',
    });

    // 1. Identity & Bio state
    const [form, setForm] = useState<IdentityFormState>(() => toIdentityForm(initialOfficial));
    const [formVersion, setFormVersion] = useState<number>(initialOfficial?.version ?? 1);
    const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
    const [savingIdentity, setSavingIdentity] = useState(false);
    const [uploadingPortrait, setUploadingPortrait] = useState(false);
    const portraitInputRef = useRef<HTMLInputElement>(null);

    // 2. Tenures state
    const [editingTenureId, setEditingTenureId] = useState<string | null>(null);
    const [tenureFormOpen, setTenureFormOpen] = useState(false);
    const [tenureForm, setTenureForm] = useState<TenureFormState>(emptyTenureForm);
    const [tenureErrors, setTenureErrors] = useState<Record<string, string>>({});
    const [savingTenure, setSavingTenure] = useState(false);

    // 3. CV Entries state
    const [editingCvId, setEditingCvId] = useState<string | null>(null);
    const [cvFormOpen, setCvFormOpen] = useState(false);
    const [cvForm, setCvForm] = useState<CvEntryFormState>(emptyCvEntryForm);
    const [cvErrors, setCvErrors] = useState<Record<string, string>>({});
    const [savingCv, setSavingCv] = useState(false);

    // 4. Evidence state
    const [evidenceFormOpen, setEvidenceFormOpen] = useState(false);
    const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(emptyEvidenceForm);
    const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});
    const [savingEvidence, setSavingEvidence] = useState(false);

    const adoptOfficial = (next: GovtOfficialDetail) => {
        setOfficial(next);
        setForm(toIdentityForm(next));
        setFormVersion(next.version);
    };

    const refreshOfficial = () => {
        router.reload({
            only: ['official'],
            onSuccess: (page) => {
                const updated = (page.props as unknown as Props).official;
                if (updated) {
                    setOfficial(updated);
                    setFormVersion(updated.version);
                }
            },
        });
    };

    const setField = <K extends keyof IdentityFormState>(
        key: K,
        value: IdentityFormState[K],
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleUploadPortrait = async (file: File) => {
        setUploadingPortrait(true);
        try {
            const res = await govtCvsApi.uploadPortrait(file, official?.id);
            const url = res.url || res.portrait_url || '';
            if (url) {
                setField('portrait_url', url);
                notify.success('رُفعت الصورة بنجاح');
            }
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر رفع الصورة'));
        } finally {
            setUploadingPortrait(false);
            if (portraitInputRef.current) portraitInputRef.current.value = '';
        }
    };

    const saveIdentity = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingIdentity(true);
        setIdentityErrors({});

        const payload = {
            slug: orNull(form.slug),
            full_name_ar: form.full_name_ar.trim(),
            display_name_ar: (form.display_name_ar || form.full_name_ar).trim(),
            full_name_en: orNull(form.full_name_en),
            honorific_ar: orNull(form.honorific_ar),
            office_status: form.office_status,
            highest_tier: form.highest_tier,
            birth_year: numOrNull(form.birth_year),
            birth_place_ar: orNull(form.birth_place_ar),
            gender: orNull(form.gender),
            languages: form.languages
                .split(/[،,]/)
                .map((l) => l.trim())
                .filter(Boolean),
            bio_summary_ar: orNull(form.bio_summary_ar),
            portrait_url: orNull(form.portrait_url),
            cv_completeness: form.cv_completeness,
            publish_status: form.publish_status,
            verification_level: form.verification_level,
            official_entity_id: orNull(form.official_entity_id),
            candidate_id: orNull(form.candidate_id),
            promise_speaker_id: orNull(form.promise_speaker_id),
            house_member_id: numOrNull(form.house_member_id),
            aliases: form.aliases
                .filter((a) => a.alias_ar.trim() !== '')
                .map((a) => ({
                    alias_ar: a.alias_ar.trim(),
                    alias_type: a.alias_type,
                    source_note: orNull(a.source_note ?? ''),
                })),
            version: formVersion,
        };

        try {
            if (official) {
                const res = await govtCvsApi.updateOfficial<{ official: GovtOfficialDetail }>(
                    official.id,
                    payload,
                );
                if (res?.official) {
                    adoptOfficial(res.official);
                } else {
                    refreshOfficial();
                }
                notify.success('حُفظت البيانات الأساسية');
            } else {
                const res = await govtCvsApi.createOfficial<{ official: GovtOfficialDetail }>(
                    payload,
                );
                notify.success('أُنشئ ملف المسؤول');
                if (res?.official?.id) {
                    router.visit(`/admin/govtcvs/officials/${res.official.id}`);
                }
            }
        } catch (err) {
            setIdentityErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر حفظ البيانات الأساسية'));
        } finally {
            setSavingIdentity(false);
        }
    };

    // Tenures handlers
    const openCreateTenure = () => {
        setEditingTenureId(null);
        setTenureForm(emptyTenureForm());
        setTenureErrors({});
        setTenureFormOpen(true);
    };

    const openEditTenure = (t: GovtTenureItem) => {
        setEditingTenureId(t.id);
        setTenureForm(tenureToForm(t));
        setTenureErrors({});
        setTenureFormOpen(true);
    };

    const handleSlotSelect = (slotId: string) => {
        if (slotId === NONE) {
            setTenureForm((f) => ({ ...f, office_slot_id: NONE }));
            return;
        }
        const selectedSlot = slots.find((s) => s.id === slotId);
        if (selectedSlot) {
            setTenureForm((f) => ({
                ...f,
                office_slot_id: selectedSlot.id,
                role_title_ar: f.role_title_ar || selectedSlot.title_ar,
                institution_id: selectedSlot.institution_id ?? f.institution_id,
                institution_name_ar:
                    selectedSlot.institution_name_ar ?? f.institution_name_ar,
                tier: selectedSlot.tier || f.tier,
            }));
        }
    };

    const saveTenure = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!official) return;
        setSavingTenure(true);
        setTenureErrors({});

        const selectedInst = institutions.find((i) => i.id === tenureForm.institution_id);
        const payload = {
            office_slot_id: orNull(tenureForm.office_slot_id),
            role_title_ar: tenureForm.role_title_ar.trim(),
            institution_id: orNull(tenureForm.institution_id),
            institution_name_ar:
                orNull(tenureForm.institution_name_ar) ?? selectedInst?.name_ar ?? null,
            tier: tenureForm.tier,
            government_phase: tenureForm.government_phase,
            status: tenureForm.status,
            started_at: orNull(tenureForm.started_at),
            start_date_precision: tenureForm.start_date_precision,
            start_decree_ref: orNull(tenureForm.start_decree_ref),
            ended_at: orNull(tenureForm.ended_at),
            end_date_precision: orNull(tenureForm.end_date_precision),
            end_reason: orNull(tenureForm.end_reason),
            end_decree_ref: orNull(tenureForm.end_decree_ref),
            is_acting: tenureForm.is_acting,
            auto_close_incumbent: tenureForm.auto_close_incumbent,
            notes_ar: orNull(tenureForm.notes_ar),
        };

        try {
            const res = editingTenureId
                ? await govtCvsApi.updateTenure(editingTenureId, payload)
                : await govtCvsApi.createTenure(official.id, payload);
            notify.success(editingTenureId ? 'حُدّث المنصب' : 'أُضيف المنصب');
            setTenureFormOpen(false);
            setEditingTenureId(null);
            if (res?.official) adoptOfficial(res.official);
            else refreshOfficial();
        } catch (err) {
            setTenureErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر حفظ المنصب'));
        } finally {
            setSavingTenure(false);
        }
    };

    const deleteTenure = async (t: GovtTenureItem) => {
        const ok = await confirmDialog({
            title: `حذف منصب «${t.role_title_ar}»؟`,
            description: 'سيُحذف هذا المنصب من المسيرة الحكومية للمسؤول.',
            destructive: true,
            confirmText: 'حذف',
        });
        if (!ok) return;
        try {
            const res = await govtCvsApi.deleteTenure(t.id);
            notify.success('حُذف المنصب');
            if (res?.official) adoptOfficial(res.official);
            else refreshOfficial();
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف المنصب'));
        }
    };

    // CV Entries handlers
    const openCreateCvEntry = () => {
        setEditingCvId(null);
        setCvForm(emptyCvEntryForm());
        setCvErrors({});
        setCvFormOpen(true);
    };

    const openEditCvEntry = (entry: GovtCvEntryItem) => {
        setEditingCvId(entry.id);
        setCvForm(cvEntryToForm(entry));
        setCvErrors({});
        setCvFormOpen(true);
    };

    const saveCvEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!official) return;
        setSavingCv(true);
        setCvErrors({});

        const payload = {
            section: cvForm.section,
            title_ar: cvForm.title_ar.trim(),
            organization_ar: orNull(cvForm.organization_ar),
            location_ar: orNull(cvForm.location_ar),
            start_year: numOrNull(cvForm.start_year),
            end_year: cvForm.is_ongoing ? null : numOrNull(cvForm.end_year),
            is_ongoing: cvForm.is_ongoing,
            details_ar: orNull(cvForm.details_ar),
        };

        try {
            const res = editingCvId
                ? await govtCvsApi.updateCvEntry(editingCvId, payload)
                : await govtCvsApi.createCvEntry(official.id, payload);
            notify.success(editingCvId ? 'حُدّث بند السيرة الذاتية' : 'أُضيف بند السيرة الذاتية');
            setCvFormOpen(false);
            setEditingCvId(null);
            if (res?.official) adoptOfficial(res.official);
            else refreshOfficial();
        } catch (err) {
            setCvErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر حفظ بند السيرة الذاتية'));
        } finally {
            setSavingCv(false);
        }
    };

    const deleteCvEntry = async (entry: GovtCvEntryItem) => {
        const ok = await confirmDialog({
            title: `حذف بند «${entry.title_ar}»؟`,
            destructive: true,
            confirmText: 'حذف',
        });
        if (!ok) return;
        try {
            const res = await govtCvsApi.deleteCvEntry(entry.id);
            notify.success('حُذف بند السيرة الذاتية');
            if (res?.official) adoptOfficial(res.official);
            else refreshOfficial();
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف البند'));
        }
    };

    // Evidence handlers
    const openCreateEvidence = () => {
        setEvidenceForm(emptyEvidenceForm());
        setEvidenceErrors({});
        setEvidenceFormOpen(true);
    };

    const saveEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!official) return;
        setSavingEvidence(true);
        setEvidenceErrors({});

        const payload = {
            evidence_type: evidenceForm.evidence_type,
            tenure_id: orNull(evidenceForm.tenure_id),
            source_title_ar: evidenceForm.source_title_ar.trim(),
            source_channel_ar: orNull(evidenceForm.source_channel_ar),
            source_url: orNull(evidenceForm.source_url),
            published_date: orNull(evidenceForm.published_date),
            excerpt_ar: orNull(evidenceForm.excerpt_ar),
        };

        try {
            const res = await govtCvsApi.createEvidence(official.id, payload);
            notify.success('أُضيف المصدر الرسمي');
            setEvidenceFormOpen(false);
            if (res?.official) adoptOfficial(res.official);
            else refreshOfficial();
        } catch (err) {
            setEvidenceErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر إضافة المصدر'));
        } finally {
            setSavingEvidence(false);
        }
    };

    const deleteEvidence = async (ev: GovtEvidenceItem) => {
        const ok = await confirmDialog({
            title: `حذف مصدر «${ev.source_title_ar}»؟`,
            destructive: true,
            confirmText: 'حذف',
        });
        if (!ok) return;
        try {
            const res = await govtCvsApi.deleteEvidence(ev.id);
            notify.success('حُذف المصدر');
            if (res?.official) adoptOfficial(res.official);
            else refreshOfficial();
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر حذف المصدر'));
        }
    };

    const sortableCvItems = useMemo<SortableListItem[]>(() => {
        return (official?.cv_entries ?? [])
            .toSorted((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((entry) => ({
                id: entry.id,
                label: entry.title_ar,
                subtitle: [
                    CV_SECTION_LABELS[entry.section] ?? entry.section,
                    entry.organization_ar,
                    entry.start_year ? String(entry.start_year) : null,
                ]
                    .filter(Boolean)
                    .join(' · '),
            }));
    }, [official?.cv_entries]);

    const tabMeta: Array<{
        id: EditorTabId;
        label: string;
        icon: typeof User;
        count?: number;
        disabled?: boolean;
    }> = [
        { id: 'identity', label: 'البيانات الأساسية', icon: User },
        {
            id: 'tenures',
            label: 'المناصب والمسيرة',
            icon: History,
            count: official?.tenures?.length ?? 0,
            disabled: !official,
        },
        {
            id: 'cv',
            label: 'بنود السيرة الذاتية',
            icon: FileText,
            count: official?.cv_entries?.length ?? 0,
            disabled: !official,
        },
        {
            id: 'evidence',
            label: 'المصادر والوثائق',
            icon: Link2,
            count: official?.evidence_links?.length ?? 0,
            disabled: !official,
        },
    ];

    const identityErrorList = Object.values(identityErrors);

    return (
        <MainLayout>
            <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" dir="rtl">
                <AdminHeader
                    title={
                        official
                            ? `تعديل: ${official.display_name_ar || official.full_name_ar}`
                            : 'إضافة مسؤول جديد'
                    }
                    current="officials"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {official && official.publish_status === 'published' && (
                                <Button asChild variant="outline" size="sm" className="gap-1.5">
                                    <a
                                        href={`/govtcvs/${official.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                        عرض الملف العام
                                    </a>
                                </Button>
                            )}
                            <Button asChild variant="ghost" size="sm" className="gap-1">
                                <Link href="/admin/govtcvs">
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    كل المسؤولين
                                </Link>
                            </Button>
                        </div>
                    }
                />

                {official && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3.5">
                        <OfficialAvatar
                            name={official.display_name_ar || official.full_name_ar}
                            portraitUrl={form.portrait_url || official.portrait_url}
                            resolvedPortraitUrl={official.resolved_portrait_url}
                            size={44}
                        />
                        <div className="me-auto min-w-0">
                            <p className="font-bold text-foreground">
                                {[official.honorific_ar, official.full_name_ar]
                                    .filter(Boolean)
                                    .join(' ')}
                            </p>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                                /govtcvs/{official.slug} · الإصدار #{formVersion}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <OfficeStatusBadge status={official.office_status} />
                            <TierBadge tier={official.highest_tier} short />
                            <CvCompletenessBadge completeness={official.cv_completeness} short />
                            <PublishStatusBadge status={official.publish_status} />
                        </div>
                    </div>
                )}

                {/* Accessible Tab List */}
                <div
                    {...tabs.tabListProps}
                    aria-label="أقسام تحرير ملف المسؤول"
                    className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/60 p-1.5"
                >
                    {tabMeta.map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                {...tabs.tabProps(tab.id)}
                                disabled={tab.disabled}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                    isSelected
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <Badge
                                        variant={isSelected ? 'default' : 'outline'}
                                        className="px-1.5 py-0 text-[11px] tabular-nums"
                                        dir="ltr"
                                    >
                                        {tab.count}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* TAB 1: Identity & Bio */}
                <div
                    {...tabs.panelProps('identity')}
                    hidden={activeTab !== 'identity'}
                    className="space-y-6"
                >
                    {identityErrorList.length > 0 && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>
                                <p className="font-semibold">راجع الحقول التالية:</p>
                                <ul className="mt-1 list-disc ps-5">
                                    {identityErrorList.slice(0, 8).map((msg, i) => (
                                        <li key={i}>{msg}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={saveIdentity} className="space-y-6" noValidate>
                        <fieldset disabled={!canSaveIdentity} className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <h2 className="text-base font-bold text-foreground">
                                        الهوية والاسم والصورة
                                    </h2>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="full_name_ar">الاسم الكامل بالعربية *</Label>
                                        <Input
                                            id="full_name_ar"
                                            aria-required="true"
                                            value={form.full_name_ar}
                                            onChange={(e) =>
                                                setField('full_name_ar', e.target.value)
                                            }
                                            {...fieldA11y(
                                                'full_name_ar-error',
                                                identityErrors.full_name_ar,
                                            )}
                                        />
                                        <FieldError
                                            id="full_name_ar-error"
                                            message={identityErrors.full_name_ar}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="display_name_ar">اسم العرض المختصر *</Label>
                                        <Input
                                            id="display_name_ar"
                                            aria-required="true"
                                            value={form.display_name_ar}
                                            onChange={(e) =>
                                                setField('display_name_ar', e.target.value)
                                            }
                                            placeholder="يُنسخ تلقائياً من الاسم الكامل إن تُرك فارغاً"
                                            {...fieldA11y(
                                                'display_name_ar-error',
                                                identityErrors.display_name_ar,
                                            )}
                                        />
                                        <FieldError
                                            id="display_name_ar-error"
                                            message={identityErrors.display_name_ar}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="honorific_ar">اللقب التشريفي / العلمي</Label>
                                        <Input
                                            id="honorific_ar"
                                            value={form.honorific_ar}
                                            onChange={(e) =>
                                                setField('honorific_ar', e.target.value)
                                            }
                                            placeholder="مثال: الدكتور، المهندس، اللواء"
                                            {...fieldA11y(
                                                'honorific_ar-error',
                                                identityErrors.honorific_ar,
                                            )}
                                        />
                                        <FieldError
                                            id="honorific_ar-error"
                                            message={identityErrors.honorific_ar}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="full_name_en">الاسم بالإنكليزية</Label>
                                        <Input
                                            id="full_name_en"
                                            dir="ltr"
                                            value={form.full_name_en}
                                            onChange={(e) =>
                                                setField('full_name_en', e.target.value)
                                            }
                                            {...fieldA11y(
                                                'full_name_en-error',
                                                identityErrors.full_name_en,
                                            )}
                                        />
                                        <FieldError
                                            id="full_name_en-error"
                                            message={identityErrors.full_name_en}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="slug">المعرّف في الرابط (Slug)</Label>
                                        <Input
                                            id="slug"
                                            dir="ltr"
                                            value={form.slug}
                                            onChange={(e) => setField('slug', e.target.value)}
                                            placeholder="يُولَّد تلقائياً إن تُرك فارغاً"
                                            {...fieldA11y('slug-error', identityErrors.slug)}
                                        />
                                        <FieldError id="slug-error" message={identityErrors.slug} />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="portrait_url">الصورة الشخصية</Label>
                                        <div className="flex items-center gap-2">
                                            <OfficialAvatar
                                                name={
                                                    form.display_name_ar ||
                                                    form.full_name_ar ||
                                                    '؟'
                                                }
                                                portraitUrl={form.portrait_url}
                                                resolvedPortraitUrl={
                                                    official?.resolved_portrait_url
                                                }
                                                size={40}
                                            />
                                            <Input
                                                id="portrait_url"
                                                dir="ltr"
                                                value={form.portrait_url}
                                                onChange={(e) =>
                                                    setField('portrait_url', e.target.value)
                                                }
                                                placeholder="رابط الصورة أو ارفع صورة..."
                                                {...fieldA11y(
                                                    'portrait_url-error',
                                                    identityErrors.portrait_url,
                                                )}
                                            />
                                            <input
                                                ref={portraitInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                className="hidden"
                                                aria-hidden="true"
                                                tabIndex={-1}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleUploadPortrait(file);
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                disabled={uploadingPortrait}
                                                onClick={() => portraitInputRef.current?.click()}
                                                aria-label="رفع صورة شخصية"
                                                title="رفع صورة شخصية"
                                            >
                                                {uploadingPortrait ? (
                                                    <Loader2
                                                        className="h-4 w-4 animate-spin"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <ImageUp
                                                        className="h-4 w-4"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </Button>
                                        </div>
                                        <FieldError
                                            id="portrait_url-error"
                                            message={identityErrors.portrait_url}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <h2 className="text-base font-bold text-foreground">
                                        الحالة والتصنيف والنبذة
                                    </h2>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="office_status">حالة المنصب</Label>
                                            <Select
                                                value={form.office_status}
                                                onValueChange={(v) => setField('office_status', v)}
                                            >
                                                <SelectTrigger
                                                    id="office_status"
                                                    aria-label="حالة المنصب"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(OFFICE_STATUS_META).map(
                                                        (item) => (
                                                            <SelectItem
                                                                key={item.key}
                                                                value={item.key}
                                                            >
                                                                {item.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="highest_tier">أعلى مستوى وظيفي</Label>
                                            <Select
                                                value={form.highest_tier}
                                                onValueChange={(v) => setField('highest_tier', v)}
                                            >
                                                <SelectTrigger
                                                    id="highest_tier"
                                                    aria-label="أعلى مستوى وظيفي"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(TIER_META).map((item) => (
                                                        <SelectItem key={item.key} value={item.key}>
                                                            {item.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="cv_completeness">اكتمال السيرة</Label>
                                            <Select
                                                value={form.cv_completeness}
                                                onValueChange={(v) =>
                                                    setField('cv_completeness', v)
                                                }
                                            >
                                                <SelectTrigger
                                                    id="cv_completeness"
                                                    aria-label="اكتمال السيرة"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(CV_COMPLETENESS_META).map(
                                                        (item) => (
                                                            <SelectItem
                                                                key={item.key}
                                                                value={item.key}
                                                            >
                                                                {item.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="verification_level">مستوى التوثيق</Label>
                                            <Select
                                                value={form.verification_level}
                                                onValueChange={(v) =>
                                                    setField('verification_level', v)
                                                }
                                            >
                                                <SelectTrigger
                                                    id="verification_level"
                                                    aria-label="مستوى التوثيق"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(VERIFICATION_LEVEL_META).map(
                                                        (item) => (
                                                            <SelectItem
                                                                key={item.key}
                                                                value={item.key}
                                                            >
                                                                {item.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="publish_status">حالة النشر</Label>
                                            <Select
                                                value={form.publish_status}
                                                onValueChange={(v) => setField('publish_status', v)}
                                                disabled={!canPublish && !!official}
                                            >
                                                <SelectTrigger
                                                    id="publish_status"
                                                    aria-label="حالة النشر"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(PUBLISH_STATUS_META).map(
                                                        (item) => (
                                                            <SelectItem
                                                                key={item.key}
                                                                value={item.key}
                                                            >
                                                                {item.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="gender">الجنس</Label>
                                            <Select
                                                value={form.gender}
                                                onValueChange={(v) => setField('gender', v)}
                                            >
                                                <SelectTrigger id="gender" aria-label="الجنس">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>— غير محدد —</SelectItem>
                                                    <SelectItem value="male">ذكر</SelectItem>
                                                    <SelectItem value="female">أنثى</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="birth_year">سنة الميلاد</Label>
                                            <Input
                                                id="birth_year"
                                                type="number"
                                                dir="ltr"
                                                value={form.birth_year}
                                                onChange={(e) =>
                                                    setField('birth_year', e.target.value)
                                                }
                                                placeholder="1975"
                                                {...fieldA11y(
                                                    'birth_year-error',
                                                    identityErrors.birth_year,
                                                )}
                                            />
                                            <FieldError
                                                id="birth_year-error"
                                                message={identityErrors.birth_year}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="birth_place_ar">مكان الميلاد</Label>
                                            <Input
                                                id="birth_place_ar"
                                                value={form.birth_place_ar}
                                                onChange={(e) =>
                                                    setField('birth_place_ar', e.target.value)
                                                }
                                                placeholder="دمشق"
                                                {...fieldA11y(
                                                    'birth_place_ar-error',
                                                    identityErrors.birth_place_ar,
                                                )}
                                            />
                                            <FieldError
                                                id="birth_place_ar-error"
                                                message={identityErrors.birth_place_ar}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="languages">
                                                اللغات (افصل بينها بفاصلة)
                                            </Label>
                                            <Input
                                                id="languages"
                                                value={form.languages}
                                                onChange={(e) =>
                                                    setField('languages', e.target.value)
                                                }
                                                placeholder="العربية، الإنكليزية"
                                                {...fieldA11y(
                                                    'languages-error',
                                                    identityErrors.languages,
                                                )}
                                            />
                                            <FieldError
                                                id="languages-error"
                                                message={identityErrors.languages}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="bio_summary_ar">نبذة تعريفية عامة</Label>
                                        <Textarea
                                            id="bio_summary_ar"
                                            rows={4}
                                            value={form.bio_summary_ar}
                                            onChange={(e) =>
                                                setField('bio_summary_ar', e.target.value)
                                            }
                                            placeholder="ملخص موثّق للسيرة الذاتية والمسيرة المهنية..."
                                            {...fieldA11y(
                                                'bio_summary_ar-error',
                                                identityErrors.bio_summary_ar,
                                            )}
                                        />
                                        <FieldError
                                            id="bio_summary_ar-error"
                                            message={identityErrors.bio_summary_ar}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Aliases Dynamic Rows */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-base font-bold text-foreground">
                                            الأسماء والصيغ البديلة
                                        </h2>
                                        <CardDescription>
                                            الكنى أو الأسماء المختصرة لتسهيل البحث والربط مع المصادر.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() =>
                                            setField('aliases', [
                                                ...form.aliases,
                                                {
                                                    alias_ar: '',
                                                    alias_type: 'patronymic_short',
                                                    source_note: '',
                                                },
                                            ])
                                        }
                                    >
                                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                        إضافة اسم بديل
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {form.aliases.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            لا توجد أسماء بديلة مضافة.
                                        </p>
                                    ) : (
                                        form.aliases.map((alias, idx) => (
                                            <div
                                                key={alias.id ?? idx}
                                                className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)_auto]"
                                            >
                                                <div className="space-y-1">
                                                    <Label htmlFor={`alias_ar_${idx}`}>
                                                        الاسم البديل
                                                    </Label>
                                                    <Input
                                                        id={`alias_ar_${idx}`}
                                                        value={alias.alias_ar}
                                                        onChange={(e) =>
                                                            setField(
                                                                'aliases',
                                                                form.aliases.map((item, i) =>
                                                                    i === idx
                                                                        ? {
                                                                              ...item,
                                                                              alias_ar:
                                                                                  e.target.value,
                                                                          }
                                                                        : item,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor={`alias_type_${idx}`}>
                                                        النوع
                                                    </Label>
                                                    <Select
                                                        value={alias.alias_type}
                                                        onValueChange={(v) =>
                                                            setField(
                                                                'aliases',
                                                                form.aliases.map((item, i) =>
                                                                    i === idx
                                                                        ? { ...item, alias_type: v }
                                                                        : item,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id={`alias_type_${idx}`}
                                                            aria-label={`نوع الاسم البديل ${idx + 1}`}
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {GOVT_ALIAS_TYPE_KEYS.map((k) => (
                                                                <SelectItem key={k} value={k}>
                                                                    {ALIAS_TYPE_LABELS[k]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor={`alias_note_${idx}`}>
                                                        ملاحظة المصدر
                                                    </Label>
                                                    <Input
                                                        id={`alias_note_${idx}`}
                                                        value={alias.source_note ?? ''}
                                                        onChange={(e) =>
                                                            setField(
                                                                'aliases',
                                                                form.aliases.map((item, i) =>
                                                                    i === idx
                                                                        ? {
                                                                              ...item,
                                                                              source_note:
                                                                                  e.target.value,
                                                                          }
                                                                        : item,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="flex items-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`إزالة الاسم البديل ${idx + 1}`}
                                                        onClick={() =>
                                                            setField(
                                                                'aliases',
                                                                form.aliases.filter(
                                                                    (_, i) => i !== idx,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <X
                                                            className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                                            aria-hidden="true"
                                                        />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            {/* Cross-Module Links */}
                            <Card>
                                <CardHeader>
                                    <h2 className="text-base font-bold text-foreground">
                                        الربط مع أقسام الموقع الأخرى (اختياري)
                                    </h2>
                                    <CardDescription>
                                        يربط المسؤول بحساباته الرسمية وتقييم الحكومة وعداد الوعود ومجلس الشعب.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="official_entity_id">
                                            معرّف الحسابات الرسمية (official_entity_id)
                                        </Label>
                                        <Input
                                            id="official_entity_id"
                                            dir="ltr"
                                            value={form.official_entity_id}
                                            onChange={(e) =>
                                                setField('official_entity_id', e.target.value)
                                            }
                                            placeholder="Entity ID"
                                            {...fieldA11y(
                                                'official_entity_id-error',
                                                identityErrors.official_entity_id,
                                            )}
                                        />
                                        <FieldError
                                            id="official_entity_id-error"
                                            message={identityErrors.official_entity_id}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="candidate_id">
                                            معرّف تير ليست الحكومة (candidate_id)
                                        </Label>
                                        <Input
                                            id="candidate_id"
                                            dir="ltr"
                                            value={form.candidate_id}
                                            onChange={(e) =>
                                                setField('candidate_id', e.target.value)
                                            }
                                            placeholder="UUID"
                                            {...fieldA11y(
                                                'candidate_id-error',
                                                identityErrors.candidate_id,
                                            )}
                                        />
                                        <FieldError
                                            id="candidate_id-error"
                                            message={identityErrors.candidate_id}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="promise_speaker_id">
                                            معرّف صاحب التصريح في عداد الوعود (promise_speaker_id)
                                        </Label>
                                        <Input
                                            id="promise_speaker_id"
                                            dir="ltr"
                                            value={form.promise_speaker_id}
                                            onChange={(e) =>
                                                setField('promise_speaker_id', e.target.value)
                                            }
                                            placeholder="UUID"
                                            {...fieldA11y(
                                                'promise_speaker_id-error',
                                                identityErrors.promise_speaker_id,
                                            )}
                                        />
                                        <FieldError
                                            id="promise_speaker_id-error"
                                            message={identityErrors.promise_speaker_id}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="house_member_id">
                                            معرّف عضو مجلس الشعب (house_member_id)
                                        </Label>
                                        <Input
                                            id="house_member_id"
                                            type="number"
                                            dir="ltr"
                                            value={form.house_member_id}
                                            onChange={(e) =>
                                                setField('house_member_id', e.target.value)
                                            }
                                            placeholder="ID"
                                            {...fieldA11y(
                                                'house_member_id-error',
                                                identityErrors.house_member_id,
                                            )}
                                        />
                                        <FieldError
                                            id="house_member_id-error"
                                            message={identityErrors.house_member_id}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </fieldset>

                        {canSaveIdentity && (
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={savingIdentity}
                                    className="gap-2"
                                >
                                    {savingIdentity ? (
                                        <Loader2
                                            className="h-4 w-4 animate-spin"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Save className="h-4 w-4" aria-hidden="true" />
                                    )}
                                    {official ? 'حفظ البيانات الأساسية' : 'إنشاء ملف المسؤول'}
                                </Button>
                            </div>
                        )}
                    </form>
                </div>

                {/* TAB 2: Tenures */}
                <div
                    {...tabs.panelProps('tenures')}
                    hidden={activeTab !== 'tenures'}
                    className="space-y-6"
                >
                    {official && (
                        <>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-base font-bold text-foreground">
                                            المناصب الحكومية منذ 8 كانون الأول 2024
                                        </h2>
                                        <CardDescription>
                                            أضف أو عدّل المناصب وتواريخ التعيين والمغادرة والمراسيم.
                                        </CardDescription>
                                    </div>
                                    {canEdit && !tenureFormOpen && (
                                        <Button
                                            type="button"
                                            onClick={openCreateTenure}
                                            className="gap-1.5"
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            إضافة منصب
                                        </Button>
                                    )}
                                </CardHeader>

                                {tenureFormOpen && (
                                    <CardContent className="border-b border-border bg-muted/20 p-5">
                                        <form
                                            onSubmit={saveTenure}
                                            className="space-y-4"
                                            noValidate
                                        >
                                            <h3 className="text-sm font-bold text-foreground">
                                                {editingTenureId
                                                    ? 'تعديل المنصب'
                                                    : 'إضافة منصب جديد'}
                                            </h3>

                                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_office_slot_id">
                                                        المنصب القياسي (اختياري)
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.office_slot_id}
                                                        onValueChange={handleSlotSelect}
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_office_slot_id"
                                                            aria-label="المنصب القياسي"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value={NONE}>
                                                                — منصب مخصّص بدون شاغر قياسي —
                                                            </SelectItem>
                                                            {slots.map((slot) => (
                                                                <SelectItem
                                                                    key={slot.id}
                                                                    value={slot.id}
                                                                >
                                                                    {slot.title_ar}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_role_title_ar">
                                                        المسمى الوظيفي *
                                                    </Label>
                                                    <Input
                                                        id="tenure_role_title_ar"
                                                        value={tenureForm.role_title_ar}
                                                        onChange={(e) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                role_title_ar: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="مثال: وزير الخارجية والمغتربين"
                                                        {...fieldA11y(
                                                            'tenure_role_title_ar-error',
                                                            tenureErrors.role_title_ar,
                                                        )}
                                                    />
                                                    <FieldError
                                                        id="tenure_role_title_ar-error"
                                                        message={tenureErrors.role_title_ar}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_institution_id">
                                                        الجهة الحكومية
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.institution_id}
                                                        onValueChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                institution_id: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_institution_id"
                                                            aria-label="الجهة الحكومية"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value={NONE}>
                                                                — بلا جهة مرتبطة —
                                                            </SelectItem>
                                                            {institutions.map((inst) => (
                                                                <SelectItem
                                                                    key={inst.id}
                                                                    value={inst.id}
                                                                >
                                                                    {inst.name_ar}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_institution_name_ar">
                                                        اسم الجهة (نص مخصّص)
                                                    </Label>
                                                    <Input
                                                        id="tenure_institution_name_ar"
                                                        value={tenureForm.institution_name_ar}
                                                        onChange={(e) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                institution_name_ar: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="يُملأ تلقائياً من الجهة المختارة إن تُرك فارغاً"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_tier">
                                                        المستوى الوظيفي
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.tier}
                                                        onValueChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                tier: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_tier"
                                                            aria-label="المستوى الوظيفي"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.values(TIER_META).map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={item.key}
                                                                        value={item.key}
                                                                    >
                                                                        {item.label}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_phase">
                                                        المرحلة الحكومية
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.government_phase}
                                                        onValueChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                government_phase: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_phase"
                                                            aria-label="المرحلة الحكومية"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.values(PHASE_META).map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={item.key}
                                                                        value={item.key}
                                                                    >
                                                                        {item.label}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_status">
                                                        حالة الولاية
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.status}
                                                        onValueChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                status: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_status"
                                                            aria-label="حالة الولاية"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.values(
                                                                TENURE_STATUS_META,
                                                            ).map((item) => (
                                                                <SelectItem
                                                                    key={item.key}
                                                                    value={item.key}
                                                                >
                                                                    {item.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_started_at">
                                                        تاريخ البدء
                                                    </Label>
                                                    <Input
                                                        id="tenure_started_at"
                                                        type="date"
                                                        dir="ltr"
                                                        value={tenureForm.started_at}
                                                        onChange={(e) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                started_at: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_start_precision">
                                                        دقة تاريخ البدء
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.start_date_precision}
                                                        onValueChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                start_date_precision: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_start_precision"
                                                            aria-label="دقة تاريخ البدء"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {GOVT_DATE_PRECISION_KEYS.map((k) => (
                                                                <SelectItem key={k} value={k}>
                                                                    {DATE_PRECISION_LABELS[k]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_start_decree">
                                                        مرجع مرسوم / قرار التعيين
                                                    </Label>
                                                    <Input
                                                        id="tenure_start_decree"
                                                        value={tenureForm.start_decree_ref}
                                                        onChange={(e) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                start_decree_ref: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="مثال: القرار الرئاسي رقم 5"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_ended_at">
                                                        تاريخ الانتهاء (إن انتهت)
                                                    </Label>
                                                    <Input
                                                        id="tenure_ended_at"
                                                        type="date"
                                                        dir="ltr"
                                                        value={tenureForm.ended_at}
                                                        onChange={(e) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                ended_at: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_end_reason">
                                                        سبب الانتهاء
                                                    </Label>
                                                    <Select
                                                        value={tenureForm.end_reason}
                                                        onValueChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                end_reason: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="tenure_end_reason"
                                                            aria-label="سبب الانتهاء"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value={NONE}>
                                                                — لا يوجد —
                                                            </SelectItem>
                                                            {Object.values(END_REASON_META).map(
                                                                (item) => (
                                                                    <SelectItem
                                                                        key={item.key}
                                                                        value={item.key}
                                                                    >
                                                                        {item.label}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="tenure_end_decree">
                                                        مرجع مرسوم / قرار الإنهاء
                                                    </Label>
                                                    <Input
                                                        id="tenure_end_decree"
                                                        value={tenureForm.end_decree_ref}
                                                        onChange={(e) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                end_decree_ref: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-6 pt-1">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        id="tenure_is_acting"
                                                        checked={tenureForm.is_acting}
                                                        onCheckedChange={(v) =>
                                                            setTenureForm((f) => ({
                                                                ...f,
                                                                is_acting: v,
                                                            }))
                                                        }
                                                    />
                                                    <Label
                                                        htmlFor="tenure_is_acting"
                                                        className="font-normal"
                                                    >
                                                        تعيين بالتكليف / تسيير أعمال
                                                    </Label>
                                                </div>

                                                {!editingTenureId &&
                                                    tenureForm.office_slot_id !== NONE && (
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                id="tenure_auto_close"
                                                                checked={
                                                                    tenureForm.auto_close_incumbent
                                                                }
                                                                onCheckedChange={(v) =>
                                                                    setTenureForm((f) => ({
                                                                        ...f,
                                                                        auto_close_incumbent: v,
                                                                    }))
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor="tenure_auto_close"
                                                                className="font-normal"
                                                            >
                                                                إنهاء ولاية شاغل المنصب السابق تلقائياً
                                                            </Label>
                                                        </div>
                                                    )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="tenure_notes_ar">ملاحظات</Label>
                                                <Textarea
                                                    id="tenure_notes_ar"
                                                    rows={2}
                                                    value={tenureForm.notes_ar}
                                                    onChange={(e) =>
                                                        setTenureForm((f) => ({
                                                            ...f,
                                                            notes_ar: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="submit"
                                                    disabled={savingTenure}
                                                    className="gap-1.5"
                                                >
                                                    {savingTenure && (
                                                        <Loader2
                                                            className="h-4 w-4 animate-spin"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    حفظ المنصب
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setTenureFormOpen(false);
                                                        setEditingTenureId(null);
                                                    }}
                                                >
                                                    إلغاء
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                )}

                                <CardContent className="divide-y divide-border p-5">
                                    {(official.tenures?.length ?? 0) === 0 ? (
                                        <p className="py-6 text-center text-sm text-muted-foreground">
                                            لا توجد مناصب مسجلة بعد.
                                        </p>
                                    ) : (
                                        official.tenures.map((tenure) => (
                                            <div
                                                key={tenure.id}
                                                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-bold text-foreground">
                                                            {tenure.role_title_ar}
                                                        </span>
                                                        {tenure.is_acting && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                بالتكليف
                                                            </Badge>
                                                        )}
                                                        <TierBadge tier={tenure.tier} short />
                                                        <PhaseBadge
                                                            phase={tenure.government_phase}
                                                            short
                                                        />
                                                    </div>
                                                    {tenure.institution_name_ar && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {tenure.institution_name_ar}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        من:{' '}
                                                        <span className="tabular-nums">
                                                            {tenure.started_at
                                                                ? formatGovtDate(
                                                                      tenure.started_at,
                                                                      tenure.start_date_precision,
                                                                  )
                                                                : 'غير محدد'}
                                                        </span>
                                                        {tenure.ended_at && (
                                                            <>
                                                                {' · '}إلى:{' '}
                                                                <span className="tabular-nums">
                                                                    {formatGovtDate(
                                                                        tenure.ended_at,
                                                                        tenure.end_date_precision,
                                                                    )}
                                                                </span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                {canEdit && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`تعديل منصب «${tenure.role_title_ar}»`}
                                                            onClick={() => openEditTenure(tenure)}
                                                        >
                                                            <Pencil
                                                                className="h-4 w-4"
                                                                aria-hidden="true"
                                                            />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive"
                                                            aria-label={`حذف منصب «${tenure.role_title_ar}»`}
                                                            onClick={() => deleteTenure(tenure)}
                                                        >
                                                            <Trash2
                                                                className="h-4 w-4"
                                                                aria-hidden="true"
                                                            />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                {/* TAB 3: CV Entries */}
                <div
                    {...tabs.panelProps('cv')}
                    hidden={activeTab !== 'cv'}
                    className="space-y-6"
                >
                    {official && (
                        <>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-base font-bold text-foreground">
                                            بنود السيرة الذاتية
                                        </h2>
                                        <CardDescription>
                                            المؤهلات العلمية والخبرات السابقة والنشاط المدني أو الثوري.
                                        </CardDescription>
                                    </div>
                                    {canEdit && !cvFormOpen && (
                                        <Button
                                            type="button"
                                            onClick={openCreateCvEntry}
                                            className="gap-1.5"
                                        >
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            إضافة بند سيرة ذاتية
                                        </Button>
                                    )}
                                </CardHeader>

                                {cvFormOpen && (
                                    <CardContent className="border-b border-border bg-muted/20 p-5">
                                        <form
                                            onSubmit={saveCvEntry}
                                            className="space-y-4"
                                            noValidate
                                        >
                                            <h3 className="text-sm font-bold text-foreground">
                                                {editingCvId
                                                    ? 'تعديل بند السيرة الذاتية'
                                                    : 'إضافة بند سيرة ذاتية'}
                                            </h3>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="cv_section">القسم *</Label>
                                                    <Select
                                                        value={cvForm.section}
                                                        onValueChange={(v) =>
                                                            setCvForm((f) => ({ ...f, section: v }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="cv_section"
                                                            aria-required="true"
                                                            aria-label="قسم السيرة الذاتية"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {GOVT_CV_SECTION_KEYS.map((key) => (
                                                                <SelectItem key={key} value={key}>
                                                                    {CV_SECTION_META[key].label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="cv_title_ar">
                                                        العنوان / المؤهل / المنصب *
                                                    </Label>
                                                    <Input
                                                        id="cv_title_ar"
                                                        value={cvForm.title_ar}
                                                        onChange={(e) =>
                                                            setCvForm((f) => ({
                                                                ...f,
                                                                title_ar: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="مثال: دكتوراه في الهندسة المدنية"
                                                        {...fieldA11y(
                                                            'cv_title_ar-error',
                                                            cvErrors.title_ar,
                                                        )}
                                                    />
                                                    <FieldError
                                                        id="cv_title_ar-error"
                                                        message={cvErrors.title_ar}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="cv_organization_ar">
                                                        المؤسسة / الجامعة / الجهة
                                                    </Label>
                                                    <Input
                                                        id="cv_organization_ar"
                                                        value={cvForm.organization_ar}
                                                        onChange={(e) =>
                                                            setCvForm((f) => ({
                                                                ...f,
                                                                organization_ar: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="جامعة دمشق"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="cv_location_ar">
                                                        المكان / المدينة
                                                    </Label>
                                                    <Input
                                                        id="cv_location_ar"
                                                        value={cvForm.location_ar}
                                                        onChange={(e) =>
                                                            setCvForm((f) => ({
                                                                ...f,
                                                                location_ar: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="cv_start_year">سنة البدء</Label>
                                                    <Input
                                                        id="cv_start_year"
                                                        type="number"
                                                        dir="ltr"
                                                        value={cvForm.start_year}
                                                        onChange={(e) =>
                                                            setCvForm((f) => ({
                                                                ...f,
                                                                start_year: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="2010"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="cv_end_year">
                                                        سنة الانتهاء
                                                    </Label>
                                                    <Input
                                                        id="cv_end_year"
                                                        type="number"
                                                        dir="ltr"
                                                        disabled={cvForm.is_ongoing}
                                                        value={cvForm.end_year}
                                                        onChange={(e) =>
                                                            setCvForm((f) => ({
                                                                ...f,
                                                                end_year: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="2015"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    id="cv_is_ongoing"
                                                    checked={cvForm.is_ongoing}
                                                    onCheckedChange={(v) =>
                                                        setCvForm((f) => ({ ...f, is_ongoing: v }))
                                                    }
                                                />
                                                <Label
                                                    htmlFor="cv_is_ongoing"
                                                    className="font-normal"
                                                >
                                                    مستمر حتى الآن
                                                </Label>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="cv_details_ar">تفاصيل إضافية</Label>
                                                <Textarea
                                                    id="cv_details_ar"
                                                    rows={3}
                                                    value={cvForm.details_ar}
                                                    onChange={(e) =>
                                                        setCvForm((f) => ({
                                                            ...f,
                                                            details_ar: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="submit"
                                                    disabled={savingCv}
                                                    className="gap-1.5"
                                                >
                                                    {savingCv && (
                                                        <Loader2
                                                            className="h-4 w-4 animate-spin"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    حفظ البند
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setCvFormOpen(false);
                                                        setEditingCvId(null);
                                                    }}
                                                >
                                                    إلغاء
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                )}

                                <CardContent className="space-y-6 p-5">
                                    {(official.cv_entries?.length ?? 0) === 0 ? (
                                        <p className="py-6 text-center text-sm text-muted-foreground">
                                            لا توجد بنود سيرة ذاتية مضافة بعد.
                                        </p>
                                    ) : (
                                        <>
                                            <div className="divide-y divide-border">
                                                {official.cv_entries.map((entry) => (
                                                    <div
                                                        key={entry.id}
                                                        className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                                    >
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline">
                                                                    {CV_SECTION_LABELS[
                                                                        entry.section
                                                                    ] ?? entry.section}
                                                                </Badge>
                                                                <span className="font-bold text-foreground">
                                                                    {entry.title_ar}
                                                                </span>
                                                            </div>
                                                            {(entry.organization_ar ||
                                                                entry.location_ar) && (
                                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                                    {[
                                                                        entry.organization_ar,
                                                                        entry.location_ar,
                                                                    ]
                                                                        .filter(Boolean)
                                                                        .join(' · ')}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {canEdit && (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label={`تعديل بند «${entry.title_ar}»`}
                                                                    onClick={() =>
                                                                        openEditCvEntry(entry)
                                                                    }
                                                                >
                                                                    <Pencil
                                                                        className="h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive"
                                                                    aria-label={`حذف بند «${entry.title_ar}»`}
                                                                    onClick={() =>
                                                                        deleteCvEntry(entry)
                                                                    }
                                                                >
                                                                    <Trash2
                                                                        className="h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {sortableCvItems.length > 1 && (
                                                <div className="border-t border-border pt-4">
                                                    <h3 className="mb-3 text-sm font-bold text-foreground">
                                                        ترتيب عرض البنود
                                                    </h3>
                                                    <SortableList
                                                        key={sortableCvItems
                                                            .map((i) => i.id)
                                                            .join(',')}
                                                        items={sortableCvItems}
                                                        endpoint={govtCvsApi.reorderCvEntriesEndpoint(
                                                            official.id,
                                                        )}
                                                        canReorder={canEdit}
                                                        capability="govtcvs.edit"
                                                        onSaved={refreshOfficial}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                {/* TAB 4: Evidence Links */}
                <div
                    {...tabs.panelProps('evidence')}
                    hidden={activeTab !== 'evidence'}
                    className="space-y-6"
                >
                    {official && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-base font-bold text-foreground">
                                        المصادر والوثائق الرسمية
                                    </h2>
                                    <CardDescription>
                                        بطاقات السيرة الرسمية ومراسيم التعيين ومنشورات القنوات الحكومية.
                                    </CardDescription>
                                </div>
                                {canEdit && !evidenceFormOpen && (
                                    <Button
                                        type="button"
                                        onClick={openCreateEvidence}
                                        className="gap-1.5"
                                    >
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        إضافة مصدر
                                    </Button>
                                )}
                            </CardHeader>

                            {evidenceFormOpen && (
                                <CardContent className="border-b border-border bg-muted/20 p-5">
                                    <form
                                        onSubmit={saveEvidence}
                                        className="space-y-4"
                                        noValidate
                                    >
                                        <h3 className="text-sm font-bold text-foreground">
                                            إضافة مصدر رسمي جديد
                                        </h3>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="ev_type">نوع المصدر *</Label>
                                                <Select
                                                    value={evidenceForm.evidence_type}
                                                    onValueChange={(v) =>
                                                        setEvidenceForm((f) => ({
                                                            ...f,
                                                            evidence_type: v,
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="ev_type"
                                                        aria-required="true"
                                                        aria-label="نوع المصدر"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.values(EVIDENCE_TYPE_META).map(
                                                            (item) => (
                                                                <SelectItem
                                                                    key={item.key}
                                                                    value={item.key}
                                                                >
                                                                    {item.label}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="ev_tenure_id">
                                                    المنصب المرتبط (اختياري)
                                                </Label>
                                                <Select
                                                    value={evidenceForm.tenure_id}
                                                    onValueChange={(v) =>
                                                        setEvidenceForm((f) => ({
                                                            ...f,
                                                            tenure_id: v,
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="ev_tenure_id"
                                                        aria-label="المنصب المرتبط"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value={NONE}>
                                                            — عام للمسؤول —
                                                        </SelectItem>
                                                        {(official.tenures ?? []).map((t) => (
                                                            <SelectItem key={t.id} value={t.id}>
                                                                {t.role_title_ar}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="ev_source_title_ar">
                                                    عنوان المصدر *
                                                </Label>
                                                <Input
                                                    id="ev_source_title_ar"
                                                    value={evidenceForm.source_title_ar}
                                                    onChange={(e) =>
                                                        setEvidenceForm((f) => ({
                                                            ...f,
                                                            source_title_ar: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="مثال: مرسوم تعيين وزير الخارجية"
                                                    {...fieldA11y(
                                                        'ev_source_title_ar-error',
                                                        evidenceErrors.source_title_ar,
                                                    )}
                                                />
                                                <FieldError
                                                    id="ev_source_title_ar-error"
                                                    message={evidenceErrors.source_title_ar}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="ev_source_channel_ar">
                                                    القناة / الجهة الناشرة
                                                </Label>
                                                <Input
                                                    id="ev_source_channel_ar"
                                                    value={evidenceForm.source_channel_ar}
                                                    onChange={(e) =>
                                                        setEvidenceForm((f) => ({
                                                            ...f,
                                                            source_channel_ar: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="رئاسة الجمهورية العربية السورية — تلغرام"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="ev_source_url">رابط المصدر</Label>
                                                <Input
                                                    id="ev_source_url"
                                                    dir="ltr"
                                                    value={evidenceForm.source_url}
                                                    onChange={(e) =>
                                                        setEvidenceForm((f) => ({
                                                            ...f,
                                                            source_url: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="https://t.me/..."
                                                    {...fieldA11y(
                                                        'ev_source_url-error',
                                                        evidenceErrors.source_url,
                                                    )}
                                                />
                                                <FieldError
                                                    id="ev_source_url-error"
                                                    message={evidenceErrors.source_url}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="ev_published_date">
                                                    تاريخ النشر
                                                </Label>
                                                <Input
                                                    id="ev_published_date"
                                                    type="date"
                                                    dir="ltr"
                                                    value={evidenceForm.published_date}
                                                    onChange={(e) =>
                                                        setEvidenceForm((f) => ({
                                                            ...f,
                                                            published_date: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="ev_excerpt_ar">مقتطف من النص</Label>
                                            <Textarea
                                                id="ev_excerpt_ar"
                                                rows={3}
                                                value={evidenceForm.excerpt_ar}
                                                onChange={(e) =>
                                                    setEvidenceForm((f) => ({
                                                        ...f,
                                                        excerpt_ar: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="submit"
                                                disabled={savingEvidence}
                                                className="gap-1.5"
                                            >
                                                {savingEvidence && (
                                                    <Loader2
                                                        className="h-4 w-4 animate-spin"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                إضافة المصدر
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setEvidenceFormOpen(false)}
                                            >
                                                إلغاء
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            )}

                            <CardContent className="divide-y divide-border p-5">
                                {(official.evidence_links?.length ?? 0) === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">
                                        لا توجد مصادر مضافة بعد.
                                    </p>
                                ) : (
                                    official.evidence_links.map((ev) => {
                                        const href = safeHref(ev.source_url);
                                        return (
                                            <div
                                                key={ev.id}
                                                className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline">
                                                            {EVIDENCE_TYPE_META[
                                                                ev.evidence_type as keyof typeof EVIDENCE_TYPE_META
                                                            ]?.label ?? ev.evidence_type}
                                                        </Badge>
                                                        <span className="font-bold text-foreground">
                                                            {ev.source_title_ar}
                                                        </span>
                                                        {ev.published_date && (
                                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                                {formatGovtDate(ev.published_date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {ev.source_channel_ar && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {ev.source_channel_ar}
                                                        </p>
                                                    )}
                                                    {href && (
                                                        <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                        >
                                                            <ExternalLink
                                                                className="h-3 w-3"
                                                                aria-hidden="true"
                                                            />
                                                            <span dir="ltr">{href}</span>
                                                        </a>
                                                    )}
                                                </div>

                                                {canEdit && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive"
                                                        aria-label={`حذف مصدر «${ev.source_title_ar}»`}
                                                        onClick={() => deleteEvidence(ev)}
                                                    >
                                                        <Trash2
                                                            className="h-4 w-4"
                                                            aria-hidden="true"
                                                        />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
