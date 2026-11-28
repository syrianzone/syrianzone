import React, { forwardRef } from 'react';
import type { AxisId, Spectrum } from '@/Domain/compass/types';
import { AXES } from '@/Domain/compass/axes';
import { axisDisplay } from '@/Domain/compass/axisDisplay';
import SpectrumIcon from '@/Domain/compass/SpectrumIcon';
import BrandShareFrame, {
  MADAR_DISPLAY_FONT,
} from '@/Components/share/BrandShareFrame';

interface Props {
  spectrum: Spectrum | null;
  axes: Partial<Record<AxisId, number | null>>;
  themeKey: string;
  format?: 'story' | 'square';
}

/**
 * Editorial Madar share card for Syria Compass results (9:16 story or 1:1 square).
 * Highlights the spectrum hero and the 4 strongest defining axes so the card
 * reads cleanly in 2 seconds on WhatsApp/Instagram/X.
 */
const CompassShareCard = forwardRef<HTMLDivElement, Props>(function CompassShareCard(
  { spectrum, axes, themeKey, format = 'story' },
  ref,
) {
  const isStory = format === 'story';

  const topAxes = [...AXES]
    .filter((a) => axes[a.id] != null)
    .sort((a, b) => Math.abs((axes[b.id] as number) ?? 0) - Math.abs((axes[a.id] as number) ?? 0))
    .slice(0, 4);

  const displayAxes = topAxes.length > 0 ? topAxes : AXES.slice(0, 4);

  return (
    <BrandShareFrame
      ref={ref}
      id="compass-card-canvas"
      themeId={themeKey}
      moduleLabel="بوصلة سوريا"
      shareUrl="syrian.zone/compass"
      format={format}
    >
      {(tokens) => {
        const trackBg = tokens.isDark ? 'rgba(238,240,255,0.14)' : 'rgba(23,26,46,0.10)';
        const chipBg = `rgba(${tokens.primaryRgb}, ${tokens.isDark ? 0.18 : 0.10})`;
        const chipBorder = `rgba(${tokens.primaryRgb}, ${tokens.isDark ? 0.36 : 0.25})`;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 22 : 16 }}>
            {/* 1. Hero spectrum focal point */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.primary,
                  backgroundColor: chipBg,
                  border: `1.5px solid ${chipBorder}`,
                  marginBottom: 10,
                }}
              >
                <SpectrumIcon name={spectrum?.icon} className="h-6 w-6" />
              </div>

              <div
                style={{
                  fontFamily: MADAR_DISPLAY_FONT,
                  fontSize: isStory ? 30 : 28,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  color: tokens.ink,
                }}
              >
                {spectrum?.name ?? 'نتيجتك السياسية'}
              </div>

              {spectrum?.short && (
                <div
                  style={{
                    fontSize: 13,
                    color: tokens.muted,
                    lineHeight: 1.5,
                    marginTop: 6,
                  }}
                >
                  {spectrum.short}
                </div>
              )}
            </div>

            {/* 2. Top 4 defining axes */}
            <div
              style={{
                backgroundColor: tokens.card,
                border: `1px solid ${tokens.border}`,
                borderRadius: 14,
                padding: isStory ? '16px 16px' : '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: isStory ? 14 : 12,
              }}
            >
              {displayAxes.map((a) => {
                const raw = axes[a.id];
                const has = raw != null;
                const val = has ? (raw as number) : 0;
                const { leftLabel, rightLabel, positiveOnLeft } = axisDisplay(a);
                const pct = Math.min(Math.abs(val), 1) * 50;
                const fillOnLeft = (val >= 0) === positiveOnLeft;

                return (
                  <div key={a.id}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                        color: tokens.ink,
                      }}
                    >
                      <span>{rightLabel}</span>
                      <span>{leftLabel}</span>
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: trackBg,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: -2,
                          bottom: -2,
                          width: 2,
                          backgroundColor: tokens.node,
                        }}
                      />
                      {has && pct > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            borderRadius: 999,
                            backgroundColor: tokens.primary,
                            ...(fillOnLeft
                              ? { right: '50%', width: `${pct}%` }
                              : { left: '50%', width: `${pct}%` }),
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }}
    </BrandShareFrame>
  );
});

export default CompassShareCard;
