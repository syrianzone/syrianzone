import { formatDate, formatNumber } from '@/Domain/promises/format';
import type { PromiseTarget } from '@/Domain/promises/types';

/**
 * Progress towards a measurable target. Renders nothing until a sourced
 * progress reading exists, so a promise is never shown as "0%" by default.
 */
export default function TargetProgress({ target, detailed = false }: { target: PromiseTarget; detailed?: boolean }) {
    const unit = target.unit ? ` ${target.unit}` : '';

    if (target.percent === null) {
        return detailed ? (
            <p className="text-sm text-muted-foreground">
                الهدف: <span className="font-semibold text-foreground tabular-nums">{formatNumber(target.value)}{unit}</span>
                {target.baseline !== null && <> · نقطة البداية: <span className="tabular-nums">{formatNumber(target.baseline)}{unit}</span></>}
                {' '}— لا توجد قراءة تقدّم موثّقة بعد.
            </p>
        ) : null;
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(target.current)}</span>
                    {' من '}
                    <span className="tabular-nums">{formatNumber(target.value)}</span>
                    {unit}
                </span>
                <span className="font-semibold tabular-nums text-foreground" dir="ltr">{target.percent}%</span>
            </div>
            <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={target.percent}
                aria-label="نسبة الإنجاز نحو الهدف"
            >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${target.percent}%` }} />
            </div>
            {detailed && (
                <p className="text-xs text-muted-foreground">
                    {target.baseline !== null && <>نقطة البداية: <span className="tabular-nums">{formatNumber(target.baseline)}{unit}</span>{target.baselineNote ? ` (${target.baselineNote})` : ''} · </>}
                    آخر قراءة: {formatDate(target.currentOn)}
                </p>
            )}
        </div>
    );
}
