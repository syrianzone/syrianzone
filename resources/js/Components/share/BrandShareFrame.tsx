import React, { forwardRef } from 'react';
import Logo from '@/Components/brand/Logo';
import { resolveShareBrandTokens, type ShareBrandTokens } from '@/Lib/theme';

export const MADAR_DISPLAY_FONT = '"Beiruti", "IBM Plex Sans Arabic", sans-serif';
export const MADAR_BODY_FONT = '"IBM Plex Sans Arabic", sans-serif';
export const MADAR_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export type ShareFrameFormat = 'story' | 'square' | 'landscape' | 'auto';

export interface BrandShareFrameProps {
  /** 'nili' (light), 'nili-night' (dark), or any app theme id. */
  themeId: string;
  /** Module badge displayed in the top bar (e.g. 'عداد الوعود', 'بوصلة سوريا'). */
  moduleLabel: string;
  /** Public address shown in the footer (e.g. 'syrian.zone/compass'). */
  shareUrl: string;
  /** Right-aligned Arabic attribution in the footer (defaults to 'المساحة السورية'). */
  footerLabel?: string;
  /** Layout preset controlling dimensions and safe-zone padding. */
  format?: ShareFrameFormat;
  /** Override frame width in CSS pixels. */
  width?: number;
  /** Optional DOM id used by exportElementAsPng for isolated capture. */
  id?: string;
  /** Optional render-prop or plain ReactNode children. */
  children: React.ReactNode | ((tokens: ShareBrandTokens) => React.ReactNode);
}

/**
 * Shared Madar visual frame for every client-side share image (mirrors the
 * server OG signature in `scripts/og/lib/cards.mjs`):
 * - Warm paper (`#F7F6F1`) or Indigo Night (`#0E1129`) ground
 * - 6 px RTL right-edge primary rail with a contrasting saffron node notch
 * - Top bar with explicit-hex `<Logo />` and module pill
 * - Safe-zone breathing room on 9:16 story exports
 * - Bottom 1 px rule with Arabic attribution and `dir="ltr"` domain
 *
 * All colours are inline hex/rgb so `html2canvas-pro` reproduces them faithfully.
 */
const BrandShareFrame = forwardRef<HTMLDivElement, BrandShareFrameProps>(function BrandShareFrame(
  {
    themeId,
    moduleLabel,
    shareUrl,
    footerLabel = 'المساحة السورية',
    format = 'square',
    width,
    id,
    children,
  },
  ref,
) {
  const tokens = resolveShareBrandTokens(themeId);
  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  const frameWidth =
    width ?? (isStory ? 360 : isLandscape ? 680 : format === 'square' ? 440 : 480);

  const frameStyle: React.CSSProperties = {
    width: frameWidth,
    ...(isStory ? { height: 640 } : format === 'square' ? { minHeight: 440 } : {}),
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: isStory ? 18 : 18,
    paddingTop: isStory ? 34 : 24,
    paddingBottom: isStory ? 28 : 20,
    paddingRight: isStory ? 26 : 28, // accounts for the 6px RTL rail
    paddingLeft: isStory ? 20 : 22,
    backgroundColor: tokens.ground,
    color: tokens.ink,
    fontFamily: MADAR_BODY_FONT,
    direction: 'rtl',
    textAlign: 'right',
    boxSizing: 'border-box',
  };

  return (
    <div
      ref={ref}
      id={id}
      dir="rtl"
      data-theme={tokens.themeId}
      data-scheme={tokens.isDark ? 'dark' : 'light'}
      style={frameStyle}
    >
      {/* 6px RTL right-edge primary rail */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 6,
          backgroundColor: tokens.primary,
        }}
      />
      {/* Saffron node notch along the right rail */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: isStory ? 30 : 22,
          right: 0,
          width: 6,
          height: 24,
          backgroundColor: tokens.node,
        }}
      />

      {/* Top bar: Madar lockup + module pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingBottom: isStory ? 8 : 10,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <Logo
          variant="lockup"
          title=""
          colors={{
            ink: tokens.ink,
            orbit: tokens.orbit,
            bowl: tokens.bowl,
            node: tokens.node,
          }}
          style={{
            height: isStory ? 24 : 28,
            width: 'auto',
            display: 'block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.3,
            padding: '4px 11px',
            borderRadius: 999,
            backgroundColor: tokens.card,
            border: `1px solid ${tokens.border}`,
            color: tokens.primary,
            whiteSpace: 'nowrap',
          }}
        >
          {moduleLabel}
        </span>
      </div>

      {/* Main content slot */}
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 0,
        }}
      >
        {typeof children === 'function' ? children(tokens) : children}
      </div>

      {/* Bottom attribution bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: isStory ? 8 : 10,
          borderTop: `1px solid ${tokens.border}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: tokens.muted,
          }}
        >
          {footerLabel}
        </span>
        <span
          dir="ltr"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: tokens.primary,
            fontFamily: MADAR_MONO_FONT,
          }}
        >
          {shareUrl}
        </span>
      </div>
    </div>
  );
});

export default BrandShareFrame;
