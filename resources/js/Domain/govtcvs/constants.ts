import type { LucideIcon } from 'lucide-react';
import {
    ArrowLeftRight,
    Award,
    BadgeCheck,
    BookOpen,
    Briefcase,
    Building2,
    Crown,
    ExternalLink,
    FileCheck2,
    FileSignature,
    FileText,
    FileX,
    Globe,
    GraduationCap,
    HelpCircle,
    History,
    IdCard,
    Landmark,
    LogOut,
    MinusCircle,
    Newspaper,
    Scale,
    Shield,
    UserCheck,
    Users,
    Video,
} from 'lucide-react';
import { SYRIAN_MONTHS_AR } from '@/Lib/syrian-date';
import { formatEntityImage } from '@/Lib/entityImage';
import type {
    GovtAliasType,
    GovtCvCompleteness,
    GovtCvSection,
    GovtDatePrecision,
    GovtEndReason,
    GovtEvidenceType,
    GovtOfficeStatus,
    GovtPhase,
    GovtPublishStatus,
    GovtSlotStatus,
    GovtTenureStatus,
    GovtTier,
    GovtVerificationLevel,
} from './types';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface VocabItemMeta<K extends string = string> {
    key: K;
    label: string;
    shortLabel?: string;
    variant: BadgeVariant;
    icon: LucideIcon;
    tone: string;
    rank?: number;
}

export const CUTOFF_DATE = '2024-12-08';

export const OFFICE_STATUS_META: Record<GovtOfficeStatus, VocabItemMeta<GovtOfficeStatus>> = {
    in_office: {
        key: 'in_office',
        label: 'على رأس عمله',
        variant: 'default',
        icon: BadgeCheck,
        tone: 'text-primary',
    },
    out_of_office: {
        key: 'out_of_office',
        label: 'خارج المنصب',
        variant: 'secondary',
        icon: LogOut,
        tone: 'text-muted-foreground',
    },
    uncertain: {
        key: 'uncertain',
        label: 'غير مؤكّد',
        variant: 'outline',
        icon: HelpCircle,
        tone: 'text-foreground',
    },
    deceased: {
        key: 'deceased',
        label: 'متوفى',
        variant: 'secondary',
        icon: MinusCircle,
        tone: 'text-muted-foreground',
    },
};

export const OFFICE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(OFFICE_STATUS_META).map((item) => [item.key, item.label]),
);

export const TIER_META: Record<GovtTier, VocabItemMeta<GovtTier>> = {
    presidency: {
        key: 'presidency',
        label: 'رئاسة الجمهورية',
        shortLabel: 'الرئاسة',
        rank: 1,
        variant: 'default',
        icon: Crown,
        tone: 'text-primary',
    },
    minister: {
        key: 'minister',
        label: 'وزير',
        shortLabel: 'وزراء',
        rank: 2,
        variant: 'default',
        icon: Landmark,
        tone: 'text-primary',
    },
    governor: {
        key: 'governor',
        label: 'محافظ',
        shortLabel: 'محافظون',
        rank: 3,
        variant: 'secondary',
        icon: Building2,
        tone: 'text-foreground',
    },
    agency_head: {
        key: 'agency_head',
        label: 'رئيس هيئة أو مؤسسة',
        shortLabel: 'رؤساء هيئات',
        rank: 4,
        variant: 'secondary',
        icon: Building2,
        tone: 'text-foreground',
    },
    deputy_minister: {
        key: 'deputy_minister',
        label: 'معاون وزير',
        shortLabel: 'معاونو وزراء',
        rank: 5,
        variant: 'outline',
        icon: UserCheck,
        tone: 'text-foreground',
    },
    judicial: {
        key: 'judicial',
        label: 'سلطة قضائية أو دستورية',
        shortLabel: 'قضاء ودستور',
        rank: 6,
        variant: 'secondary',
        icon: Scale,
        tone: 'text-foreground',
    },
    advisory: {
        key: 'advisory',
        label: 'مستشار أو مبعوث',
        shortLabel: 'مستشارون',
        rank: 7,
        variant: 'outline',
        icon: Users,
        tone: 'text-foreground',
    },
    military_security: {
        key: 'military_security',
        label: 'قيادة عسكرية أو أمنية',
        shortLabel: 'قيادات عسكرية وأمنية',
        rank: 8,
        variant: 'outline',
        icon: Shield,
        tone: 'text-foreground',
    },
    diplomat: {
        key: 'diplomat',
        label: 'سفير أو ممثل دبلوماسي',
        shortLabel: 'دبلوماسيون',
        rank: 9,
        variant: 'outline',
        icon: Globe,
        tone: 'text-foreground',
    },
    director: {
        key: 'director',
        label: 'مدير عام أو مسؤول تنفيذي',
        shortLabel: 'مديرون عامون',
        rank: 10,
        variant: 'outline',
        icon: Briefcase,
        tone: 'text-muted-foreground',
    },
};

export const TIER_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(TIER_META).map((item) => [item.key, item.label]),
);

export const PHASE_META: Record<GovtPhase, { key: GovtPhase; label: string; shortLabel: string; variant: BadgeVariant; tone: string }> = {
    caretaker_2024: {
        key: 'caretaker_2024',
        label: 'حكومة تسيير الأعمال (2024)',
        shortLabel: 'تسيير الأعمال 2024',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    transitional_2025: {
        key: 'transitional_2025',
        label: 'الحكومة الانتقالية (2025)',
        shortLabel: 'الحكومة الانتقالية 2025',
        variant: 'default',
        tone: 'text-primary',
    },
    reshuffle_2026: {
        key: 'reshuffle_2026',
        label: 'تعديلات وتعيينات (2026)',
        shortLabel: 'تعيينات 2026',
        variant: 'default',
        tone: 'text-primary',
    },
    other: {
        key: 'other',
        label: 'مرحلة أخرى',
        shortLabel: 'أخرى',
        variant: 'outline',
        tone: 'text-muted-foreground',
    },
};

export const PHASE_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(PHASE_META).map((item) => [item.key, item.label]),
);

export const TENURE_STATUS_META: Record<GovtTenureStatus, VocabItemMeta<GovtTenureStatus>> = {
    current: {
        key: 'current',
        label: 'حالي',
        variant: 'default',
        icon: BadgeCheck,
        tone: 'text-primary',
    },
    ended: {
        key: 'ended',
        label: 'انتهت ولايته',
        variant: 'secondary',
        icon: History,
        tone: 'text-muted-foreground',
    },
    uncertain: {
        key: 'uncertain',
        label: 'غير مؤكد',
        variant: 'outline',
        icon: HelpCircle,
        tone: 'text-foreground',
    },
};

export const TENURE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(TENURE_STATUS_META).map((item) => [item.key, item.label]),
);

export const END_REASON_META: Record<GovtEndReason, { key: GovtEndReason; label: string; variant: BadgeVariant; tone: string }> = {
    replaced: {
        key: 'replaced',
        label: 'تعيين خلف له',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    reassigned: {
        key: 'reassigned',
        label: 'نقل إلى منصب آخر',
        variant: 'outline',
        tone: 'text-foreground',
    },
    promoted: {
        key: 'promoted',
        label: 'ترقية إلى منصب أعلى',
        variant: 'default',
        tone: 'text-primary',
    },
    dismissed: {
        key: 'dismissed',
        label: 'إعفاء من المنصب',
        variant: 'destructive',
        tone: 'text-destructive',
    },
    resigned: {
        key: 'resigned',
        label: 'استقالة',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    post_abolished: {
        key: 'post_abolished',
        label: 'إلغاء المنصب',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    ministry_merged: {
        key: 'ministry_merged',
        label: 'دمج الوزارة أو الهيئة',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    cabinet_transition: {
        key: 'cabinet_transition',
        label: 'انتهاء مهام الحكومة',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    deceased: {
        key: 'deceased',
        label: 'وفاة',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
};

export const END_REASON_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(END_REASON_META).map((item) => [item.key, item.label]),
);

export const CV_SECTION_META: Record<GovtCvSection, VocabItemMeta<GovtCvSection>> = {
    education: {
        key: 'education',
        label: 'التحصيل العلمي',
        variant: 'default',
        icon: GraduationCap,
        tone: 'text-primary',
    },
    career_history: {
        key: 'career_history',
        label: 'الخبرات والمناصب السابقة',
        variant: 'secondary',
        icon: Briefcase,
        tone: 'text-foreground',
    },
    military_revolutionary: {
        key: 'military_revolutionary',
        label: 'النشاط الثوري والعسكري',
        variant: 'outline',
        icon: Shield,
        tone: 'text-foreground',
    },
    civic_social: {
        key: 'civic_social',
        label: 'العمل المدني والمجتمعي',
        variant: 'outline',
        icon: Users,
        tone: 'text-foreground',
    },
    certification: {
        key: 'certification',
        label: 'الشهادات والدورات',
        variant: 'outline',
        icon: Award,
        tone: 'text-foreground',
    },
    publication: {
        key: 'publication',
        label: 'الأبحاث والمنشورات',
        variant: 'outline',
        icon: BookOpen,
        tone: 'text-foreground',
    },
};

export const CV_SECTION_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(CV_SECTION_META).map((item) => [item.key, item.label]),
);

export const CV_COMPLETENESS_META: Record<GovtCvCompleteness, VocabItemMeta<GovtCvCompleteness>> = {
    full_cv: {
        key: 'full_cv',
        label: 'سيرة ذاتية كاملة',
        shortLabel: 'سيرة كاملة',
        variant: 'default',
        icon: FileCheck2,
        tone: 'text-primary',
    },
    partial_bio: {
        key: 'partial_bio',
        label: 'نبذة جزئية',
        shortLabel: 'نبذة جزئية',
        variant: 'secondary',
        icon: FileText,
        tone: 'text-foreground',
    },
    positions_only: {
        key: 'positions_only',
        label: 'مناصب فقط',
        shortLabel: 'مناصب فقط',
        variant: 'outline',
        icon: Briefcase,
        tone: 'text-muted-foreground',
    },
};

export const CV_COMPLETENESS_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(CV_COMPLETENESS_META).map((item) => [item.key, item.label]),
);

export const EVIDENCE_TYPE_META: Record<GovtEvidenceType, VocabItemMeta<GovtEvidenceType>> = {
    cv_card: {
        key: 'cv_card',
        label: 'بطاقة سيرة ذاتية رسمية',
        variant: 'default',
        icon: IdCard,
        tone: 'text-primary',
    },
    appointment_decree: {
        key: 'appointment_decree',
        label: 'مرسوم أو قرار تعيين',
        variant: 'default',
        icon: FileSignature,
        tone: 'text-primary',
    },
    dismissal_decree: {
        key: 'dismissal_decree',
        label: 'مرسوم أو قرار إعفاء',
        variant: 'destructive',
        icon: FileX,
        tone: 'text-destructive',
    },
    handover_farewell: {
        key: 'handover_farewell',
        label: 'استلام وتسليم أو تكريم',
        variant: 'secondary',
        icon: ArrowLeftRight,
        tone: 'text-foreground',
    },
    operational_mention: {
        key: 'operational_mention',
        label: 'ظهور رسمي بممارسة المهام',
        variant: 'outline',
        icon: Newspaper,
        tone: 'text-foreground',
    },
    video_interview: {
        key: 'video_interview',
        label: 'مقابلة مصورة أو تصريح',
        variant: 'outline',
        icon: Video,
        tone: 'text-foreground',
    },
    external_source: {
        key: 'external_source',
        label: 'مصدر خارجي موثق',
        variant: 'outline',
        icon: ExternalLink,
        tone: 'text-muted-foreground',
    },
};

export const EVIDENCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(EVIDENCE_TYPE_META).map((item) => [item.key, item.label]),
);

export const PUBLISH_STATUS_META: Record<GovtPublishStatus, { key: GovtPublishStatus; label: string; variant: BadgeVariant; tone: string }> = {
    draft: {
        key: 'draft',
        label: 'مسودة',
        variant: 'outline',
        tone: 'text-muted-foreground',
    },
    published: {
        key: 'published',
        label: 'منشور',
        variant: 'default',
        tone: 'text-primary',
    },
    archived: {
        key: 'archived',
        label: 'مؤرشف',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
};

export const PUBLISH_STATUS_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(PUBLISH_STATUS_META).map((item) => [item.key, item.label]),
);

export const VERIFICATION_LEVEL_META: Record<GovtVerificationLevel, { key: GovtVerificationLevel; label: string; variant: BadgeVariant; tone: string }> = {
    decree_verified: {
        key: 'decree_verified',
        label: 'موثق بمرسوم أو قرار رسمي',
        variant: 'default',
        tone: 'text-primary',
    },
    cv_card_verified: {
        key: 'cv_card_verified',
        label: 'موثق ببطاقة سيرة ذاتية رسمية',
        variant: 'default',
        tone: 'text-primary',
    },
    operational_verified: {
        key: 'operational_verified',
        label: 'موثق من أخبار ومهام رسمية',
        variant: 'secondary',
        tone: 'text-foreground',
    },
    editorial: {
        key: 'editorial',
        label: 'رصد تحريري',
        variant: 'outline',
        tone: 'text-muted-foreground',
    },
};

export const VERIFICATION_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(VERIFICATION_LEVEL_META).map((item) => [item.key, item.label]),
);

export const ALIAS_TYPE_LABELS: Record<GovtAliasType, string> = {
    patronymic_short: 'اسم مختصر (بدون اسم الأب)',
    kunya: 'كنية أو لقب',
    ocr_variant: 'صيغة بديلة في المصادر',
    english: 'الاسم بالإنكليزية',
    former_spelling: 'تهجئة سابقة',
};

export const DATE_PRECISION_LABELS: Record<GovtDatePrecision, string> = {
    exact: 'تاريخ دقيق',
    month: 'بالشهر والسنة',
    year: 'بالسنة فقط',
    first_seen: 'أول ظهور رُصد في المنصب',
    inferred_successor: 'مُستنتج من تعيين الخلف',
};

export const SLOT_STATUS_META: Record<GovtSlotStatus, { key: GovtSlotStatus; label: string; variant: BadgeVariant; tone: string }> = {
    active: {
        key: 'active',
        label: 'قائم',
        variant: 'default',
        tone: 'text-primary',
    },
    merged: {
        key: 'merged',
        label: 'مُدمج',
        variant: 'secondary',
        tone: 'text-muted-foreground',
    },
    abolished: {
        key: 'abolished',
        label: 'مُلغى',
        variant: 'outline',
        tone: 'text-muted-foreground',
    },
};

export const SLOT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
    Object.values(SLOT_STATUS_META).map((item) => [item.key, item.label]),
);

export const GENDER_LABELS: Record<string, string> = {
    male: 'ذكر',
    female: 'أنثى',
};

export const MOVEMENT_KIND_META: Record<'appointment' | 'transition' | 'exit', { label: string; variant: BadgeVariant }> = {
    appointment: {
        label: 'تعيين',
        variant: 'default',
    },
    transition: {
        label: 'انتقال / تسليم واستلام',
        variant: 'secondary',
    },
    exit: {
        label: 'مغادرة المنصب',
        variant: 'outline',
    },
};

/**
 * Format an ISO date (YYYY-MM-DD) using Levantine Arabic month names and Western digits,
 * matching the Precision level when provided.
 */
export function formatGovtDate(iso: string | null | undefined, precision?: string | null): string {
    if (!iso) return '';
    const parts = iso.slice(0, 10).split('-').map(Number);
    const [y, m, d] = parts;
    if (!y) return iso;
    if (precision === 'year' || !m) return `${y}`;
    const monthName = SYRIAN_MONTHS_AR[m - 1] ?? '';
    if (precision === 'month' || !d) return `${monthName} ${y}`;
    return `${d} ${monthName} ${y}`;
}

/** Resolve an official portrait URL, returning null if none exists so initials fallback renders. */
export function resolveOfficialPortrait(
    resolvedUrl?: string | null,
    rawUrl?: string | null,
): string | null {
    const candidate = resolvedUrl || rawUrl;
    if (!candidate || candidate.trim() === '' || candidate === '/placeholder-user.jpg') {
        return null;
    }
    if (candidate.startsWith('http://') || candidate.startsWith('https://') || candidate.startsWith('/')) {
        return candidate;
    }
    const formatted = formatEntityImage(candidate);
    return formatted === '/placeholder-user.jpg' ? null : formatted;
}

/** Extract Arabic initials (up to 2 letters) for the circular avatar fallback. */
export function officialInitials(name: string | null | undefined): string {
    if (!name) return '؟';
    const cleaned = name
        .replace(/^(الدكتور|المهندس|القاضي|الشيخ|اللواء|العميد|العقيد|الأستاذ|د\.|م\.)\s+/u, '')
        .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '؟';
    if (words.length === 1) return words[0].charAt(0) || '؟';
    return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`;
}

/** Safe URL validator for external evidence and social links. */
export function safeHref(url: string | null | undefined): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    return /^(https?:\/\/|\/(?!\/))/i.test(trimmed) ? trimmed : null;
}
