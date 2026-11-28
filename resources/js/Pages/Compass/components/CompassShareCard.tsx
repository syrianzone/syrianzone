import React, { forwardRef } from 'react';
import type { AxisId, Spectrum } from '@/Domain/compass/types';
import { AXES } from '@/Domain/compass/axes';
import { axisDisplay } from '@/Domain/compass/axisDisplay';
import SpectrumIcon from '@/Domain/compass/SpectrumIcon';
import BrandShareFrame, {
  MADAR_DISPLAY_FONT,
  MADAR_MONO_FONT,
} from '@/Components/share/BrandShareFrame';

const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

interface Props {
  spectrum: Spectrum | null;
  axes: Partial<Record<AxisId, number | null>>;
  themeKey: string;
  format?: 'story' | 'square';
}

/**
 * Madar share card for Syria Compass results (9:16 story or 1:1 square).
 * Uses explicit hex tokens via `BrandShareFrame` for crisp html2canvas-pro output.
 */
const CompassShareCard = forwardRef<HTMLDivElement, Props>(function CompassShareCard(
  { spectrum, axes, themeKey, format = 'story' },
  ref,
) {
  const isStory = format === 'story';

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
        const trackBg = tokens.isDark ? 'rgba(238,240,255,0.12)' : 'rgba(23,26,46,0.10)';
        const chipBg = `rgba(${tokens.primaryRgb}, ${tokens.isDark ? 0.18 : 0.10})`;
        const chipBorder = `rgba(${tokens.primaryRgb}, ${tokens.isDark ? 0.36 : 0.25})`;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 12 : 14 }}>
            {/* Hero spectrum header */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  width: isStory ? 44 : 48,
                  height: isStory ? 44 : 48,
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.primary,
                  backgroundColor: chipBg,
                  border: `1px solid ${chipBorder}`,
                  marginBottom: 6,
                }}
              >
                <SpectrumIcon name={spectrum?.icon} className="h-6 w-6" />
              </div>

              <div
                style={{
                  fontFamily: MADAR_DISPLAY_FONT,
                  fontSize: isStory ? 22 : 24,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  color: tokens.ink,
                }}
              >
                {spectrum?.name ?? 'نتيجتك السياسية'}
              </div>

              {spectrum && (
                <div
                  style={{
                    fontSize: isStory ? 10 : 11,
                    color: tokens.muted,
                    lineHeight: 1.5,
                    marginTop: 4,
                  }}
                >
                  {spectrum.short}
                </div>
              )}

              {spectrum && spectrum.stances.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 5,
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                >
                  {spectrum.stances.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: isStory ? 9 : 10,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 999,
                        color: tokens.primary,
                        backgroundColor: chipBg,
                        border: `1px solid ${chipBorder}`,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Axes panel */}
            <div
              style={{
                backgroundColor: tokens.card,
                border: `1px solid ${tokens.border}`,
                borderRadius: 14,
                padding: isStory ? '10px 12px' : '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: isStory ? 10 : 11,
                  fontWeight: 800,
                  color: tokens.muted,
                  marginBottom: isStory ? 8 : 10,
                }}
              >
                موقعك على المحاور
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 7 : 8 }}>
                {AXES.map((a) => {
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
                          gap: 6,
                          fontSize: isStory ? 8.5 : 9.5,
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: tokens.ink }}>{rightLabel}</span>
                        <span
                          dir="ltr"
                          style={{
                            fontFamily: MADAR_MONO_FONT,
                            fontWeight: 700,
                            color: tokens.primary,
                          }}
                        >
                          {has ? fmt(val) : '—'}
                        </span>
                        <span style={{ fontWeight: 700, color: tokens.ink }}>{leftLabel}</span>
                      </div>
                      <div
                        style={{
                          position: 'relative',
                          height: 6,
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
                            width: 1.5,
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
          </div>
        );
      }}
    </BrandShareFrame>
  );
});

export default CompassShareCard;
