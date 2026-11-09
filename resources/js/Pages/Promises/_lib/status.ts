import type { LucideIcon } from 'lucide-react';
import {
    AlarmClock, BadgeCheck, Bus, CalendarClock, CircleDashed, CircleEllipsis, Droplets, GraduationCap,
    HeartPulse, Hourglass, House, Landmark, Scale, ShoppingCart, Undo2, Users, Wallet, Wifi, Wrench,
    XCircle, Zap,
} from 'lucide-react';
import type { PromiseState, PromiseStatus } from './types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/**
 * Display metadata per state. Colour is carried by badge variants and
 * semantic tokens only (`text-destructive`, `text-primary`, …) so every theme,
 * including high-contrast, renders the states correctly.
 */
export const STATE_META: Record<PromiseState, {
    label: string;
    variant: BadgeVariant;
    icon: LucideIcon;
    /** Token class for the big countdown number. */
    tone: string;
}> = {
    pending: { label: 'قيد الانتظار', variant: 'outline', icon: Hourglass, tone: 'text-foreground' },
    in_progress: { label: 'قيد التنفيذ', variant: 'outline', icon: Wrench, tone: 'text-foreground' },
    overdue: { label: 'متأخر', variant: 'destructive', icon: AlarmClock, tone: 'text-destructive' },
    fulfilled: { label: 'تحقق', variant: 'default', icon: BadgeCheck, tone: 'text-primary' },
    partially_fulfilled: { label: 'تحقق جزئياً', variant: 'secondary', icon: CircleDashed, tone: 'text-primary' },
    broken: { label: 'لم يتحقق', variant: 'destructive', icon: XCircle, tone: 'text-destructive' },
    postponed: { label: 'أُجّل', variant: 'secondary', icon: CalendarClock, tone: 'text-muted-foreground' },
    retracted: { label: 'سُحب', variant: 'secondary', icon: Undo2, tone: 'text-muted-foreground' },
};

export const STATUS_ORDER: PromiseStatus[] = [
    'pending', 'in_progress', 'fulfilled', 'partially_fulfilled', 'broken', 'postponed', 'retracted',
];

export const VENUE_LABEL: Record<string, string> = {
    x_post: 'منشور على إكس',
    facebook_post: 'منشور على فيسبوك',
    telegram_post: 'منشور على تلغرام',
    tv_interview: 'مقابلة تلفزيونية',
    news_interview: 'مقابلة صحفية',
    press_conference: 'مؤتمر صحفي',
    official_statement: 'بيان رسمي',
    speech: 'خطاب',
    other: 'أخرى',
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
    x_post: 'منشور على إكس',
    facebook_post: 'منشور على فيسبوك',
    telegram_post: 'منشور على تلغرام',
    tv_interview: 'مقابلة تلفزيونية',
    press_conference: 'مؤتمر صحفي',
    official_statement: 'بيان رسمي',
    news_article: 'خبر صحفي',
    video: 'فيديو',
};

export const UPDATE_TYPE_LABEL: Record<string, string> = {
    progress: 'تقدّم',
    status_change: 'تغيّر الحالة',
    official_response: 'ردّ رسمي',
    note: 'ملاحظة',
};

/** Where a speaker-picker option comes from (SpeakerDirectory::search). */
export const SPEAKER_SOURCE_LABEL: Record<string, string> = {
    speaker: 'في القائمة',
    candidate: 'من تقييم الحكومة',
    official: 'من الحسابات الرسمية',
    house: 'من مجلس الشعب',
};

/** A speaker proposed by a visitor and not yet approved. */
export const PENDING_SPEAKER_LABEL = 'بانتظار المراجعة';

/** Sector icon keys as stored in `promise_sectors.icon`. */
export const SECTOR_ICONS: Record<string, LucideIcon> = {
    zap: Zap,
    wallet: Wallet,
    'shopping-cart': ShoppingCart,
    house: House,
    droplets: Droplets,
    bus: Bus,
    landmark: Landmark,
    wifi: Wifi,
    'heart-pulse': HeartPulse,
    'graduation-cap': GraduationCap,
    scale: Scale,
    users: Users,
    'circle-ellipsis': CircleEllipsis,
};

/** Arabic names for the sector icons, shown to admins choosing one. */
export const SECTOR_ICON_LABELS: Record<string, string> = {
    zap: 'برق (طاقة)',
    wallet: 'محفظة (رواتب)',
    'shopping-cart': 'عربة تسوّق (أسعار)',
    house: 'منزل (سكن)',
    droplets: 'قطرات (مياه وخدمات)',
    bus: 'حافلة (نقل)',
    landmark: 'مبنى (اقتصاد)',
    wifi: 'شبكة (اتصالات)',
    'heart-pulse': 'نبض (صحة)',
    'graduation-cap': 'قبعة تخرّج (تعليم)',
    scale: 'ميزان (حوكمة)',
    users: 'أشخاص (عودة ونزوح)',
    'circle-ellipsis': 'نقاط (أخرى)',
};

export function sectorIcon(key: string | null | undefined): LucideIcon {
    return (key && SECTOR_ICONS[key]) || CircleEllipsis;
}

/** States still awaiting a verdict. */
export function isOpenState(state: PromiseState): boolean {
    return state === 'pending' || state === 'in_progress' || state === 'overdue';
}
