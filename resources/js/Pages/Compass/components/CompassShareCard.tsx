import React, { forwardRef } from 'react';
import type { AxisId, Spectrum } from '../data/types';
import { AXES } from '../data/axes';
import { axisDisplay } from '../lib/axisDisplay';
import SpectrumIcon from './SpectrumIcon';
import { getThemeById, THEME_REGISTRY } from '@/lib/theme';

const hexToRgb = (hex: string): string => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

interface Props {
  spectrum: Spectrum | null;
  axes: Partial<Record<AxisId, number | null>>;
  themeKey: string;
}

/** 360×640 story card used for the "share as image" download. Colours are
 *  driven entirely by the active theme's palette (explicit hex/rgb) so
 *  html2canvas-pro needs no colour conversion. */
const CompassShareCard = forwardRef<HTMLDivElement, Props>(function CompassShareCard(
  { spectrum, axes, themeKey },
  ref
) {
  const theme = getThemeById(themeKey) || THEME_REGISTRY[2];
  const isLight = theme.id === 'light';
  const pri = theme.priorities;
  const primary = theme.primary || '#5a714a';
  const primaryRgb = pri?.primaryRgb || hexToRgb(primary);
  const urlText = pri?.urlText || primary;
  const gradient =
    pri?.gradient ||
    (isLight ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' : 'linear-gradient(135deg, #0b0f19 0%, #064e3b 50%, #022c22 100%)');

  const fg = isLight ? '#0f172a' : '#ffffff';
  const sub = isLight ? '#475569' : '#94a3b8';
  const muted = isLight ? '#64748b' : 'rgba(255,255,255,0.5)';
  const faint = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.12)';
  const panelBg = isLight ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.5)';
  const panelBorder = isLight ? 'rgba(203,213,225,0.8)' : 'rgba(148,163,184,0.22)';

  return (
    <div
      ref={ref}
      id="compass-card-canvas"
      dir="rtl"
      style={{
        width: 360,
        height: 640,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 22,
        textAlign: 'right',
        color: fg,
        fontFamily: 'IBM Plex Sans Arabic, sans-serif',
        background: gradient,
      }}
    >
      <div
        className="compass-card-bg-blur"
        style={{ position: 'absolute', top: -60, right: -50, width: 200, height: 200, borderRadius: '50%', filter: 'blur(60px)', background: `rgba(${primaryRgb},0.28)` }}
      />
      <div
        className="compass-card-bg-blur"
        style={{ position: 'absolute', bottom: 40, left: -70, width: 220, height: 220, borderRadius: '50%', filter: 'blur(80px)', background: `rgba(${primaryRgb},0.14)` }}
      />

      {/* Spectrum */}
      <div style={{ position: 'relative', textAlign: 'center', marginTop: 6 }}>
        <div style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: primary, background: `rgba(${primaryRgb},0.14)`, border: `1px solid rgba(${primaryRgb},0.4)`, marginBottom: 5 }}>
          <SpectrumIcon name={spectrum?.icon} className="w-6 h-6" />
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2 }}>{spectrum?.name ?? 'نتيجتك'}</div>
        {spectrum && (
          <div style={{ fontSize: 9.5, color: sub, lineHeight: 1.5, marginTop: 4, maxHeight: 40, overflow: 'hidden' }}>
            {spectrum.short}
          </div>
        )}
        {spectrum && spectrum.stances.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginTop: 7 }}>
            {spectrum.stances.slice(0, 3).map((s) => (
              <span key={s} style={{ fontSize: 8, fontWeight: 700, padding: '3px 8px', borderRadius: 999, color: primary, background: `rgba(${primaryRgb},0.14)`, border: `1px solid rgba(${primaryRgb},0.3)` }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* All axes */}
      <div style={{ position: 'relative', background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 14, padding: '10px 12px', flex: '1 1 auto' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: sub, marginBottom: 8 }}>موقعك على المحاور</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {AXES.map((a) => {
            const raw = axes[a.id];
            const has = raw != null;
            const val = has ? (raw as number) : 0;
            const { leftLabel, rightLabel, positiveOnLeft } = axisDisplay(a);
            const pct = Math.min(Math.abs(val), 1) * 50;
            const fillOnLeft = val >= 0 === positiveOnLeft;
            return (
              <div key={a.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 7.5, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700 }}>{rightLabel}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: primary }}>{has ? fmt(val) : '—'}</span>
                  <span style={{ fontWeight: 700 }}>{leftLabel}</span>
                </div>
                <div style={{ position: 'relative', height: 6, borderRadius: 999, background: faint }}>
                  <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: panelBorder }} />
                  {has && pct > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        borderRadius: 999,
                        background: primary,
                        ...(fillOnLeft ? { right: '50%', width: `${pct}%` } : { left: '50%', width: `${pct}%` }),
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'relative', textAlign: 'center', lineHeight: 1.5 }}>
        <div style={{ fontSize: 7.5, color: muted }}>بوصلة سوريا · مشروع سوري مفتوح المصدر</div>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: urlText, direction: 'ltr', marginTop: 2 }}>
          syrian.zone/compass
        </div>
      </div>
    </div>
  );
});

export default CompassShareCard;
