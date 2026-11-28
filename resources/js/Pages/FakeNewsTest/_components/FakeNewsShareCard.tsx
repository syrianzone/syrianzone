import React, { forwardRef } from 'react';
import type { FakeNewsStats, RoundSummary } from '@/Domain/fakenewstest/types';
import BrandShareFrame, {
  MADAR_DISPLAY_FONT,
  MADAR_MONO_FONT,
} from '@/Components/share/BrandShareFrame';

interface FakeNewsShareCardProps {
  summary: RoundSummary;
  stats: FakeNewsStats | null;
  themeKey: string;
  format?: 'story' | 'square';
}

/**
 * Madar share card for Fake News Test results (9:16 story or 1:1 square).
 * Uses explicit hex tokens via `BrandShareFrame` for html2canvas-pro fidelity.
 */
const FakeNewsShareCard = forwardRef<HTMLDivElement, FakeNewsShareCardProps>(
  function FakeNewsShareCard({ summary, stats, themeKey, format = 'story' }, ref) {
    const isStory = format === 'story';

    return (
      <BrandShareFrame
        ref={ref}
        id="fakenewstest-card-canvas"
        themeId={themeKey}
        moduleLabel="هل تميّزها؟"
        shareUrl="syrian.zone/games/fakenews"
        format={format}
      >
        {(tokens) => {
          const trackBg = tokens.isDark ? 'rgba(238,240,255,0.12)' : 'rgba(23,26,46,0.10)';
          const correctBg = tokens.isDark ? 'rgba(74,222,128,0.16)' : 'rgba(31,122,77,0.11)';
          const correctBorder = tokens.isDark ? 'rgba(74,222,128,0.42)' : 'rgba(31,122,77,0.34)';
          const wrongBg = tokens.isDark ? 'rgba(248,113,113,0.16)' : 'rgba(201,59,59,0.10)';
          const wrongBorder = tokens.isDark ? 'rgba(248,113,113,0.42)' : 'rgba(201,59,59,0.32)';
          const headerTint = `rgba(${tokens.primaryRgb}, ${tokens.isDark ? 0.14 : 0.08})`;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 10 : 12 }}>
              {/* 12-segment progress strip */}
              <div style={{ display: 'flex', gap: 4 }}>
                {summary.orderedResults.map((item) => (
                  <div
                    key={item.claim.id}
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: item.correct ? tokens.success : tokens.destructive,
                    }}
                  />
                ))}
              </div>

              {/* Main score card */}
              <div
                style={{
                  borderRadius: 14,
                  backgroundColor: tokens.card,
                  border: `1px solid ${tokens.border}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    backgroundColor: headerTint,
                    borderBottom: `1px solid ${tokens.border}`,
                    padding: isStory ? '14px 14px 12px' : '16px 18px 14px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'center',
                      gap: 8,
                      direction: 'ltr',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MADAR_DISPLAY_FONT,
                        fontSize: isStory ? 38 : 42,
                        fontWeight: 900,
                        lineHeight: 1.05,
                        color: tokens.ink,
                      }}
                    >
                      {summary.score}
                      <span style={{ fontSize: 19, fontWeight: 700, color: tokens.muted }}>
                        /{summary.total}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: MADAR_MONO_FONT,
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '2px 9px',
                        borderRadius: 999,
                        backgroundColor: tokens.card,
                        border: `1px solid ${tokens.border}`,
                        color: tokens.primary,
                      }}
                    >
                      {summary.percentage}%
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: MADAR_DISPLAY_FONT,
                      fontSize: isStory ? 21 : 23,
                      fontWeight: 900,
                      lineHeight: 1.25,
                      marginTop: 6,
                      color: tokens.ink,
                    }}
                  >
                    {summary.rank.title}
                  </div>
                  <div
                    style={{
                      fontSize: isStory ? 10 : 11,
                      color: tokens.muted,
                      lineHeight: 1.45,
                      marginTop: 3,
                    }}
                  >
                    {summary.rank.subtitle}
                  </div>
                </div>

                {/* Result tile grid */}
                <div style={{ padding: isStory ? 12 : 14 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isStory ? 'repeat(6, 1fr)' : 'repeat(12, 1fr)',
                      gap: 5,
                    }}
                  >
                    {summary.orderedResults.map((item) => (
                      <div
                        key={item.claim.id}
                        style={{
                          height: isStory ? 28 : 26,
                          borderRadius: 7,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isStory ? 13 : 11,
                          fontWeight: 900,
                          backgroundColor: item.correct ? correctBg : wrongBg,
                          border: `1px solid ${item.correct ? correctBorder : wrongBorder}`,
                          color: item.correct ? tokens.success : tokens.destructive,
                        }}
                      >
                        {item.correct ? '✓' : '✕'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2x2 Category Breakdown */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                }}
              >
                {summary.byCategory.map((cat) => {
                  const barColor =
                    cat.accuracyPct >= 67
                      ? tokens.success
                      : cat.accuracyPct >= 34
                        ? tokens.primary
                        : tokens.destructive;
                  return (
                    <div
                      key={cat.kind}
                      style={{
                        borderRadius: 12,
                        backgroundColor: tokens.card,
                        border: `1px solid ${tokens.border}`,
                        padding: '9px 11px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 4,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: tokens.ink }}>
                          {cat.label}
                        </span>
                        <span
                          dir="ltr"
                          style={{
                            fontFamily: MADAR_MONO_FONT,
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: tokens.ink,
                          }}
                        >
                          {cat.correct}/{cat.total}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: trackBg,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 999,
                            backgroundColor: barColor,
                            width: `${cat.accuracyPct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Community average pill */}
              {stats && stats.average_score !== null && stats.total_runs > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px',
                      borderRadius: 999,
                      backgroundColor: tokens.card,
                      border: `1px solid ${tokens.border}`,
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: tokens.muted,
                    }}
                  >
                    <span>متوسّط المشاركين</span>
                    <span
                      dir="ltr"
                      style={{ fontFamily: MADAR_MONO_FONT, fontWeight: 800, color: tokens.ink }}
                    >
                      {stats.average_score.toFixed(1)}/{summary.total}
                    </span>
                    <span>·</span>
                    <span>{stats.total_runs} جولة</span>
                  </div>
                </div>
              )}
            </div>
          );
        }}
      </BrandShareFrame>
    );
  },
);

export default FakeNewsShareCard;
