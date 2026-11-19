import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { ShieldCheck } from 'lucide-react';
import {
    CV_COMPLETENESS_META,
    OFFICE_STATUS_META,
    PHASE_META,
    PUBLISH_STATUS_META,
    SLOT_STATUS_META,
    TIER_META,
    VERIFICATION_LEVEL_META,
} from './constants';
import type {
    GovtCvCompleteness,
    GovtOfficeStatus,
    GovtPhase,
    GovtPublishStatus,
    GovtSlotStatus,
    GovtTier,
    GovtVerificationLevel,
} from './types';

export function OfficeStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const meta = OFFICE_STATUS_META[status as GovtOfficeStatus] ?? OFFICE_STATUS_META.uncertain;
    const Icon = meta.icon;

    return (
        <Badge variant={meta.variant} className={cn('gap-1 whitespace-nowrap', className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.label}
        </Badge>
    );
}

export function TierBadge({
    tier,
    short = false,
    className,
}: {
    tier: string;
    short?: boolean;
    className?: string;
}) {
    const meta = TIER_META[tier as GovtTier] ?? TIER_META.director;
    const Icon = meta.icon;

    return (
        <Badge variant={meta.variant} className={cn('gap-1 whitespace-nowrap', className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {short && meta.shortLabel ? meta.shortLabel : meta.label}
        </Badge>
    );
}

export function CvCompletenessBadge({
    completeness,
    short = false,
    className,
}: {
    completeness: string;
    short?: boolean;
    className?: string;
}) {
    const meta =
        CV_COMPLETENESS_META[completeness as GovtCvCompleteness] ??
        CV_COMPLETENESS_META.positions_only;
    const Icon = meta.icon;

    return (
        <Badge variant={meta.variant} className={cn('gap-1 whitespace-nowrap', className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {short && meta.shortLabel ? meta.shortLabel : meta.label}
        </Badge>
    );
}

export function PublishStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const meta = PUBLISH_STATUS_META[status as GovtPublishStatus] ?? PUBLISH_STATUS_META.draft;

    return (
        <Badge variant={meta.variant} className={cn('whitespace-nowrap', className)}>
            {meta.label}
        </Badge>
    );
}

export function VerificationLevelBadge({
    level,
    className,
}: {
    level: string;
    className?: string;
}) {
    const meta =
        VERIFICATION_LEVEL_META[level as GovtVerificationLevel] ??
        VERIFICATION_LEVEL_META.editorial;

    return (
        <Badge variant={meta.variant} className={cn('gap-1 whitespace-nowrap', className)}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.label}
        </Badge>
    );
}

export function PhaseBadge({
    phase,
    short = false,
    className,
}: {
    phase: string;
    short?: boolean;
    className?: string;
}) {
    const meta = PHASE_META[phase as GovtPhase] ?? PHASE_META.other;

    return (
        <Badge variant={meta.variant} className={cn('whitespace-nowrap', className)}>
            {short ? meta.shortLabel : meta.label}
        </Badge>
    );
}

export function SlotStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const meta = SLOT_STATUS_META[status as GovtSlotStatus] ?? SLOT_STATUS_META.active;

    return (
        <Badge variant={meta.variant} className={cn('whitespace-nowrap', className)}>
            {meta.label}
        </Badge>
    );
}
