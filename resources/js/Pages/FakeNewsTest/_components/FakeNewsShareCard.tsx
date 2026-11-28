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
 * Editorial Madar share card for Fake News Test results (9:16 story or 1:1 square).
 * Designed for 2-second scannability: one unmistakable hero score + verdict,
 * a single visual ✓/✕ result grid, and one concise 2-metric takeaway bar.
 */
const FakeNewsShareCard = forwardRef<HTMLDivElement, FakeNewsShareCardProps>(
  function FakeNewsShareCard({ summary, stats, themeKey, format = 'story' }, ref) {
    const isStory = format === 'story';

    const bestCategory =
      summary.byCategory.length > 0
        ? [...summary.byCategory].sort((a, b) => b.accuracyPct - a.accuracyPct)[0]
        : null;

    const hasCommunityAvg =
      stats !== null && stats.average_score !== null && stats.total_runs > 0;

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
          const correctBg = tokens.isDark ? 'rgba(74,222,128,0.16)' : 'rgba(31,122,77,0.12)';
          const correctBorder = tokens.isDark ? 'rgba(74,222,128,0.44)' : 'rgba(31,122,77,0.34)';
          const wrongBg = tokens.isDark ? 'rgba(248,113,113,0.16)' : 'rgba(201,59,59,0.11)';
          const wrongBorder = tokens.isDark ? 'rgba(248,113,113,0.44)' : 'rgba(201,59,59,0.32)';
          const pctBg = `rgba(${tokens.primaryRgb}, ${tokens.isDark ? 0.2 : 0.1})`;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 22 : 18 }}>
              {/* 1. Hero focal point: big score + verdict */}
              <div style={{ textAlign: 'center', paddingTop: isStory ? 6 : 2 }}>
                <div
                  dir="ltr"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: MADAR_DISPLAY_FONT,
                      fontSize: isStory ? 58 : 54,
                      fontWeight: 900,
                      lineHeight: 0.95,
                      color: tokens.ink,
                    }}
                  >
                    {summary.score}
                    <span style={{ fontSize: 26, fontWeight: 700, color: tokens.muted }}>
                      /{summary.total}
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: MADAR_MONO_FONT,
                      fontSize: 14,
                      fontWeight: 800,
                      padding: '4px 11px',
                      borderRadius: 999,
                      backgroundColor: pctBg,
                      color: tokens.primary,
                    }}
                  >
                    {summary.percentage}%
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: MADAR_DISPLAY_FONT,
                    fontSize: isStory ? 28 : 26,
                    fontWeight: 900,
                    lineHeight: 1.2,
                    marginTop: 10,
                    color: tokens.ink,
                  }}
                >
                  {summary.rank.title}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: tokens.muted,
                    lineHeight: 1.5,
                    marginTop: 5,
                  }}
                >
                  {summary.rank.subtitle}
                </div>
              </div>

              {/* 2. Single clean 12-claim visual pattern */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isStory ? 'repeat(6, 1fr)' : 'repeat(12, 1fr)',
                  gap: isStory ? 7 : 5,
                }}
              >
                {summary.orderedResults.map((item) => (
                  <div
                    key={item.claim.id}
                    style={{
                      height: isStory ? 34 : 30,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isStory ? 14 : 12,
                      fontWeight: 900,
                      backgroundColor: item.correct ? correctBg : wrongBg,
                      border: `1.5px solid ${item.correct ? correctBorder : wrongBorder}`,
                      color: item.correct ? tokens.success : tokens.destructive,
                    }}
                  >
                    {item.correct ? '✓' : '✕'}
                  </div>
                ))}
              </div>

              {/* 3. Concise 2-metric takeaway bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                }}
              >
                {bestCategory && (
                  <div
                    style={{
                      borderRadius: 12,
                      backgroundColor: tokens.card,
                      border: `1px solid ${tokens.border}`,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: tokens.muted }}>
                      أقوى محور
                    </div>
                    <div
                      style={{
                        fontFamily: MADAR_DISPLAY_FONT,
                        fontSize: 16,
                        fontWeight: 800,
                        color: tokens.ink,
                        marginTop: 3,
                        lineHeight: 1.25,
                      }}
                    >
                      {bestCategory.label}
                    </div>
                    <div
                      dir="ltr"
                      style={{
                        fontFamily: MADAR_MONO_FONT,
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: tokens.primary,
                        marginTop: 2,
                        textAlign: 'right',
                      }}
                    >
                      {bestCategory.correct}/{bestCategory.total}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    borderRadius: 12,
                    backgroundColor: tokens.card,
                    border: `1px solid ${tokens.border}`,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: tokens.muted }}>
                    {hasCommunityAvg ? 'متوسّط المشاركين' : 'نسبة الدقّة'}
                  </div>
                  <div
                    dir="ltr"
                    style={{
                      fontFamily: MADAR_MONO_FONT,
                      fontSize: 20,
                      fontWeight: 900,
                      color: tokens.ink,
                      marginTop: 3,
                      textAlign: 'right',
                    }}
                  >
                    {hasCommunityAvg
                      ? `${stats.average_score!.toFixed(1)}/${summary.total}`
                      : `${summary.percentage}%`}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: tokens.muted, marginTop: 1 }}>
                    {hasCommunityAvg ? `${stats.total_runs} جولة` : `${summary.score} إجابة صحيحة`}
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </BrandShareFrame>
    );
  },
);

export default FakeNewsShareCard;
