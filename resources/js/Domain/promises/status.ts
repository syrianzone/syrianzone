import type { LucideIcon } from 'lucide-react';
import {
    AlarmClock, BadgeCheck, Bus, CalendarClock, CircleDashed, CircleEllipsis, Droplets, GraduationCap,
    HeartPulse, Hourglass, House, Landmark, Scale, ShoppingCart, Undo2, Users, Wallet, Wifi, Wrench,
    XCircle, Zap,
} from 'lucide-react';
import raw from '../../../data/promises.json';
import { PROMISE_STATE_KEYS, PROMISE_STATUS_KEYS, type PromiseState, type PromiseStatus } from './types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const BADGE_VARIANTS = ['default', 'secondary', 'destructive', 'outline'] as const;

function isPromiseStateKey(value: string): value is PromiseState {
    return (PROMISE_STATE_KEYS as readonly string[]).includes(value);
}

function isBadgeVariant(value: string): value is BadgeVariant {
    return (BADGE_VARIANTS as readonly string[]).includes(value);
}

const STATE_ICONS: Record<PromiseState, LucideIcon> = {
    pending: Hourglass,
    in_progress: Wrench,
    overdue: AlarmClock,
    fulfilled: BadgeCheck,
    partially_fulfilled: CircleDashed,
    broken: XCircle,
    postponed: CalendarClock,
    retracted: Undo2,
};

/**
 * Display metadata per state, from resources/data/promises.json (the share-card
 * resolver reads the same labels). Colour is carried by badge variants and
 * semantic tokens only (`text-destructive`, `text-primary`, …) so every theme,
 * including high-contrast, renders the states correctly.
 */
export const STATE_META: Record<PromiseState, {
    label: string;
    variant: BadgeVariant;
    icon: LucideIcon;
    /** Token class for the big countdown number. */
    tone: string;
}> = Object.fromEntries(
    raw.states.map((state): [PromiseState, { label: string; variant: BadgeVariant; icon: LucideIcon; tone: string }] => {
        if (!isPromiseStateKey(state.key)) {
            throw new Error(`Unknown promise state in resources/data/promises.json: ${state.key}`);
        }
        if (!isBadgeVariant(state.badge_variant)) {
            throw new Error(`Unknown badge variant in resources/data/promises.json: ${state.badge_variant}`);
        }
        return [state.key, {
            label: state.label,
            variant: state.badge_variant,
            icon: STATE_ICONS[state.key],
            tone: state.tone,
        }];
    }),
) as Record<PromiseState, { label: string; variant: BadgeVariant; icon: LucideIcon; tone: string }>;

export const STATUS_ORDER: PromiseStatus[] = [...PROMISE_STATUS_KEYS];

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
    deadline_change: 'تأجيل الموعد',
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
