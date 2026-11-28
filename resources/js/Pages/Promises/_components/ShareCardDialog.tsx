import { usePage } from '@inertiajs/react';
import BrandShareFrame, { MADAR_DISPLAY_FONT } from '@/Components/share/BrandShareFrame';
import ShareImageDialog from '@/Components/share/ShareImageDialog';
import Countdown from './Countdown';
import SpeakerAvatar from '@/Domain/promises/SpeakerAvatar';
import StateBadge from '@/Domain/promises/StateBadge';
import { formatDate } from '@/Domain/promises/format';
import type { PromiseDetailData } from '@/Domain/promises/types';

/**
 * Square Madar share card with today's live promise count, rendered in the
 * browser so the counter is never stale.
 *
 * Nothing inside the captured node uses `truncate`: html2canvas lays out
 * ellipsised RTL text wrongly and clips Arabic names.
 */
export default function ShareCardDialog({ promise, open, onOpenChange }: {
    promise: PromiseDetailData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { seo } = usePage().props as { seo?: { canonical?: string } };
    const filename = `promise-${promise.number}.png`;

    // The canonical URL comes from the server (config('seo.base_url')), so the
    // card prints the public address even when exported from a local host.
    const shareUrl = (seo?.canonical ?? `syrian.zone/promises/${promise.number}`).replace(/^https?:\/\//, '');

    const coSpeakers = promise.coSpeakers ?? [];
    const allSpeakers = [promise.speaker, ...coSpeakers];
    const speakerNames = allSpeakers.map((s) => s.name).filter(Boolean).join(' و');
    const speakerTitles = allSpeakers.map((s) => s.title).filter(Boolean).join(' · ');

    return (
        <ShareImageDialog
            open={open}
            onOpenChange={onOpenChange}
            title="صورة للمشاركة"
            description="صورة بعدّاد اليوم لنشرها على وسائل التواصل."
            filename={filename}
            shareTitle={promise.title}
            defaultFormat="square"
            previewMaxWidth={440}
            renderCard={({ themeId, cardRef }) => (
                <BrandShareFrame
                    ref={cardRef}
                    id={`promise-share-${promise.number}`}
                    themeId={themeId}
                    moduleLabel="عداد الوعود"
                    shareUrl={shareUrl}
                    format="square"
                >
                    {(tokens) => (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 18,
                                color: tokens.ink,
                            }}
                        >
                            {/* 1. Speaker + verdict badge */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    {coSpeakers.length > 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                            {allSpeakers.map((s, idx) => (
                                                <SpeakerAvatar
                                                    key={s.id ?? idx}
                                                    name={s.name}
                                                    image={s.image}
                                                    size={42}
                                                    className={`ring-2 ring-card${idx > 0 ? ' -ms-2.5' : ''}`}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <SpeakerAvatar name={promise.speaker.name} image={promise.speaker.image} size={46} />
                                    )}
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.3, color: tokens.ink, margin: 0 }}>
                                            {speakerNames}
                                        </p>
                                        {speakerTitles && (
                                            <p style={{ fontSize: 12, lineHeight: 1.4, color: tokens.muted, margin: '2px 0 0' }}>
                                                {speakerTitles}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <StateBadge state={promise.state} keptLate={promise.keptLate} />
                            </div>

                            {/* 2. Hero headline */}
                            <p
                                style={{
                                    fontFamily: MADAR_DISPLAY_FONT,
                                    fontSize: 24,
                                    fontWeight: 900,
                                    lineHeight: 1.35,
                                    color: tokens.ink,
                                    margin: 0,
                                }}
                            >
                                {promise.title}
                            </p>

                            {/* 3. Focal counter card */}
                            <div
                                style={{
                                    borderRadius: 14,
                                    backgroundColor: tokens.card,
                                    border: `1px solid ${tokens.border}`,
                                    padding: '16px 18px 14px',
                                }}
                            >
                                <Countdown
                                    state={promise.state}
                                    counter={promise.counter}
                                    deadlineDate={promise.deadlineDate}
                                    statementDate={promise.statementDate}
                                    size="lg"
                                />
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                        borderTop: `1px solid ${tokens.border}`,
                                        marginTop: 14,
                                        paddingTop: 10,
                                        fontSize: 12,
                                        color: tokens.muted,
                                    }}
                                >
                                    <span>
                                        {promise.deadlineDate
                                            ? `الموعد ${formatDate(promise.deadlineDate)}`
                                            : `أُطلق ${formatDate(promise.statementDate)}`}
                                    </span>
                                    <span style={{ fontWeight: 700, color: tokens.primary }}>
                                        وعد #{promise.number}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </BrandShareFrame>
            )}
        />
    );
}
