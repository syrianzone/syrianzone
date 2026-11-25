import React, { forwardRef } from 'react';
import type { FakeNewsStats, RoundSummary } from '@/Domain/fakenewstest/types';
import {
  getThemeById,
  hexToRgbString,
  readThemeColor,
  readThemeRgb,
  shareCardPalette,
  THEME_REGISTRY,
} from '@/Lib/theme';

interface FakeNewsShareCardProps {
  summary: RoundSummary;
  stats: FakeNewsStats | null;
  themeKey: string;
}

/**
 * 360x640 off-screen story card captured by html2canvas-pro for PNG sharing.
 * Flat, solid theme-aligned design with no gradients or one-sided accent stripes.
 */
const FakeNewsShareCard = forwardRef<HTMLDivElement, FakeNewsShareCardProps>(
  function FakeNewsShareCard({ summary, stats, themeKey }, ref) {
    const theme = getThemeById(themeKey) || THEME_REGISTRY[2];
    const palette = shareCardPalette(theme.id);
    const primary = readThemeColor('--primary', themeKey) || theme.primary;
    const primaryRgb = readThemeRgb('--primary', themeKey) || hexToRgbString(theme.primary);

    const canvasBg = palette.isLight ? '#f8fafc' : '#0f172a';
    const cardBg = palette.isLight ? '#ffffff' : '#1e293b';
    const cardBorder = palette.isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)';
    const fg = palette.textPrimary;
    const sub = palette.textSecondary;
    const muted = palette.textMuted;
    const trackBg = palette.isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)';

    const correctBg = palette.isLight ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.22)';
    const correctBorder = palette.isLight ? 'rgba(5,150,105,0.35)' : 'rgba(52,211,153,0.45)';
    const correctFg = palette.isLight ? '#047857' : '#6ee7b7';
    const emeraldSolid = palette.isLight ? '#10b981' : '#34d399';

    const wrongBg = palette.isLight ? 'rgba(225,29,72,0.10)' : 'rgba(244,63,94,0.20)';
    const wrongBorder = palette.isLight ? 'rgba(225,29,72,0.35)' : 'rgba(251,113,133,0.45)';
    const wrongFg = palette.isLight ? '#be123c' : '#fda4af';
    const roseSolid = palette.isLight ? '#e11d48' : '#fb7185';

    return (
      <div
        ref={ref}
        id="fakenewstest-card-canvas"
        dir="rtl"
        style={{
          width: 360,
          height: 640,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20,
          textAlign: 'right',
          color: fg,
          fontFamily: 'IBM Plex Sans Arabic, sans-serif',
          background: canvasBg,
        }}
      >
        {/* Top 12-segment progress strip */}
        <div style={{ display: 'flex', gap: 4 }}>
          {summary.orderedResults.map((item) => (
            <div
              key={item.claim.id}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                background: item.correct ? emeraldSolid : roseSolid,
              }}
            />
          ))}
        </div>

        {/* Main Score Card */}
        <div
          style={{
            borderRadius: 14,
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            overflow: 'hidden',
            marginTop: 12,
          }}
        >
          <div
            style={{
              background: `rgba(${primaryRgb}, 0.10)`,
              borderBottom: `1px solid ${cardBorder}`,
              padding: '18px 16px 16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                color: primary,
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                marginBottom: 10,
              }}
            >
              هل تميّزها؟ · نسخة سوريا
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: 8,
                direction: 'ltr',
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.05, color: fg }}>
                {summary.score}
                <span style={{ fontSize: 20, fontWeight: 700, color: sub }}>/{summary.total}</span>
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  color: primary,
                }}
              >
                {summary.percentage}%
              </span>
            </div>

            <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.25, marginTop: 8, color: fg }}>
              {summary.rank.title}
            </div>
            <div style={{ fontSize: 10, color: sub, lineHeight: 1.5, marginTop: 4 }}>
              {summary.rank.subtitle}
            </div>
          </div>

          {/* 2x6 Iconic Result Grid */}
          <div style={{ padding: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 6,
              }}
            >
              {summary.orderedResults.map((item) => (
                <div
                  key={item.claim.id}
                  style={{
                    height: 30,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 900,
                    background: item.correct ? correctBg : wrongBg,
                    border: `1px solid ${item.correct ? correctBorder : wrongBorder}`,
                    color: item.correct ? correctFg : wrongFg,
                  }}
                >
                  {item.correct ? '✓' : '✕'}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2x2 Category Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            marginTop: 12,
          }}
        >
          {summary.byCategory.map((cat) => {
            const barColor =
              cat.accuracyPct >= 67 ? emeraldSolid : cat.accuracyPct >= 34 ? primary : roseSolid;
            return (
              <div
                key={cat.kind}
                style={{
                  borderRadius: 12,
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4,
                    marginBottom: 7,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: fg }}>{cat.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: fg,
                      direction: 'ltr',
                    }}
                  >
                    {cat.correct}/{cat.total}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: trackBg,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      background: barColor,
                      width: `${cat.accuracyPct}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Community Average + Branded Footer */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          {stats && stats.average_score !== null && stats.total_runs > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                fontSize: 9,
                fontWeight: 600,
                color: sub,
                marginBottom: 8,
              }}
            >
              <span>متوسّط المشاركين</span>
              <span style={{ fontWeight: 800, color: fg, direction: 'ltr' }}>
                {stats.average_score.toFixed(1)}/{summary.total}
              </span>
              <span>·</span>
              <span>{stats.total_runs} جولة</span>
            </div>
          )}

          <div style={{ fontSize: 8.5, color: muted }}>المساحة السورية · اختبار التحقّق من الأخبار</div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: primary,
              direction: 'ltr',
              marginTop: 2,
            }}
          >
            syrian.zone/games/fakenews
          </div>
        </div>
      </div>
    );
  },
);

export default FakeNewsShareCard;
