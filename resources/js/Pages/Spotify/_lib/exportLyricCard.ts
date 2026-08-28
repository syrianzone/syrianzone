const CARD_SIZE = 1080;
const FONT_FAMILY = '"IBM Plex Sans Arabic", sans-serif';
const WATERMARK = 'syrian.zone/syriafy';
const LOGO_SRC = '/assets/logo-darkmode.svg';

export type LyricCardOptions = {
  title: string;
  artist: string | null;
  lines: string[];
  coverUrl?: string | null;
};

function resolveUrl(u: string): string {
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  if (u.startsWith('/')) return `${origin}${u}`;
  return u;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

// Transcode a remote image into a data URL so the canvas stays untainted and
// formats Safari cannot decode (webp, svg quirks) are normalized first.
// Cached per args: the live preview re-renders on every line toggle and must
// not re-download the cover and logo each time.
const transcodeCache = new Map<string, Promise<string | undefined>>();

function transcodeToDataUrl(
  url: string,
  targetW: number,
  targetH: number,
  mode: 'cover' | 'contain',
  format: 'jpeg' | 'png' = 'jpeg'
): Promise<string | undefined> {
  const key = [url, targetW, targetH, mode, format].join('|');
  let hit = transcodeCache.get(key);
  if (!hit) {
    // failures are not cached so a transient network error stays retryable
    hit = transcodeUncached(url, targetW, targetH, mode, format).then((r) => {
      if (r === undefined) transcodeCache.delete(key);
      return r;
    });
    transcodeCache.set(key, hit);
  }
  return hit;
}

async function transcodeUncached(
  url: string,
  targetW: number,
  targetH: number,
  mode: 'cover' | 'contain',
  format: 'jpeg' | 'png' = 'jpeg'
): Promise<string | undefined> {
  try {
    const res = await fetch(resolveUrl(url), { cache: 'no-store', mode: 'cors' });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = () => resolve(null);
      img.onerror = () => resolve(null);
      img.src = objUrl;
    });
    URL.revokeObjectURL(objUrl);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return undefined;

    let canvasW = targetW;
    let canvasH = targetH;
    if (mode === 'contain') {
      if (targetW <= 0 && targetH > 0) {
        canvasH = targetH;
        canvasW = Math.max(1, Math.round((srcW / srcH) * canvasH));
      } else if (targetH <= 0 && targetW > 0) {
        canvasW = targetW;
        canvasH = Math.max(1, Math.round((srcH / srcW) * canvasW));
      }
    }
    const off = document.createElement('canvas');
    off.width = Math.max(1, canvasW);
    off.height = Math.max(1, canvasH);
    const octx = off.getContext('2d');
    if (!octx) return undefined;
    if (format === 'jpeg') {
      // jpeg has no alpha: use a dark fill so transparent covers blend with the card
      octx.fillStyle = '#15121f';
      octx.fillRect(0, 0, off.width, off.height);
    }
    if (mode === 'cover') {
      const minSide = Math.max(1, Math.min(srcW, srcH));
      const sx = Math.floor((srcW - minSide) / 2);
      const sy = Math.floor((srcH - minSide) / 2);
      octx.drawImage(img, sx, sy, minSide, minSide, 0, 0, off.width, off.height);
    } else {
      const ratio = Math.min(off.width / srcW, off.height / srcH);
      const dw = Math.round(srcW * ratio);
      const dh = Math.round(srcH * ratio);
      octx.drawImage(img, Math.floor((off.width - dw) / 2), Math.floor((off.height - dh) / 2), dw, dh);
    }
    return format === 'png' ? off.toDataURL('image/png') : off.toDataURL('image/jpeg', 0.95);
  } catch {
    return undefined;
  }
}

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 64px ${FONT_FAMILY}`, 'كلمات الأغنية'),
      document.fonts.load(`700 46px ${FONT_FAMILY}`, 'كلمات الأغنية'),
      document.fonts.load(`400 32px ${FONT_FAMILY}`, 'كلمات الأغنية'),
      document.fonts.load(`600 28px ${FONT_FAMILY}`, WATERMARK),
    ]);
    await document.fonts.ready;
  } catch {
    // FontFaceSet unavailable or load rejected: draw with fallback fonts
  }
}

function roundedClipPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      out.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

function fitOneLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Renders the card and returns a jpeg data URL (used for the live preview).
export async function renderLyricCard(opts: LyricCardOptions): Promise<string> {
  const { title, artist, lines, coverUrl } = opts;
  await ensureFonts();

  const [coverData, logoData] = await Promise.all([
    coverUrl ? transcodeToDataUrl(coverUrl, 280, 280, 'cover', 'jpeg') : Promise.resolve(undefined),
    transcodeToDataUrl(LOGO_SRC, 0, 64, 'contain', 'png'),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  const grad = ctx.createLinearGradient(0, 0, 0, CARD_SIZE);
  grad.addColorStop(0, '#251f38');
  grad.addColorStop(1, '#0d0b14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  try {
    ctx.direction = 'rtl';
  } catch {
    // older engines ignore direction; textAlign right still keeps the layout usable
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  const pad = 80;
  const rightX = CARD_SIZE - pad;
  const coverSize = 140;

  // header: cover thumb on the right, title/artist flowing leftwards
  let textRight = rightX;
  if (coverData) {
    const cover = await loadImage(coverData);
    if (cover.naturalWidth || cover.width) {
      ctx.save();
      roundedClipPath(ctx, rightX - coverSize, pad, coverSize, coverSize, 20);
      ctx.clip();
      ctx.drawImage(cover, rightX - coverSize, pad, coverSize, coverSize);
      ctx.restore();
      textRight = rightX - coverSize - 36;
    }
  }
  const headerMaxW = textRight - pad;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 46px ${FONT_FAMILY}`;
  ctx.fillText(fitOneLine(ctx, title, headerMaxW), textRight, pad + 58);
  if (artist) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.font = `400 32px ${FONT_FAMILY}`;
    ctx.fillText(fitOneLine(ctx, artist, headerMaxW), textRight, pad + 110);
  }

  // lyric block: shrink the font until every wrapped line fits the area
  const areaTop = pad + coverSize + 70;
  const areaBottom = CARD_SIZE - 150;
  const areaH = areaBottom - areaTop;
  const maxLineW = CARD_SIZE - pad * 2;
  const sizes = [64, 56, 48, 40, 34, 28];
  let wrapped: string[] = [];
  let lineHeight = 0;
  for (const size of sizes) {
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    lineHeight = Math.round(size * 1.6);
    wrapped = lines.flatMap((l) => wrapText(ctx, l, maxLineW));
    if (wrapped.length * lineHeight <= areaH) break;
  }
  ctx.fillStyle = '#ffffff';
  let y = areaTop + Math.max(0, (areaH - wrapped.length * lineHeight) / 2) + Math.round(lineHeight * 0.78);
  for (const ln of wrapped) {
    ctx.fillText(ln, rightX, y);
    y += lineHeight;
  }

  // footer watermark: logo + url, centered, drawn LTR
  ctx.textBaseline = 'middle';
  try {
    ctx.direction = 'ltr';
  } catch {
    // see note above
  }
  ctx.textAlign = 'left';
  ctx.font = `600 28px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  const footerY = CARD_SIZE - 76;
  const gap = 14;
  const logoH = 32;
  let logoImg: HTMLImageElement | undefined;
  let logoW = 0;
  if (logoData) {
    logoImg = await loadImage(logoData);
    const sW = logoImg.naturalWidth || logoImg.width;
    const sH = logoImg.naturalHeight || logoImg.height;
    if (sW && sH) logoW = Math.max(1, Math.round(sW * (logoH / sH)));
    else logoImg = undefined;
  }
  const textW = ctx.measureText(WATERMARK).width;
  const totalW = textW + (logoImg ? gap + logoW : 0);
  const startX = Math.floor((CARD_SIZE - totalW) / 2);
  ctx.fillText(WATERMARK, startX, footerY);
  if (logoImg && logoW > 0) {
    ctx.drawImage(logoImg, startX + textW + gap, footerY - Math.floor(logoH / 2), logoW, logoH);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}

export async function exportLyricCard(opts: LyricCardOptions): Promise<void> {
  const dataUrl = await renderLyricCard(opts);
  const safeTitle = opts.title.replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim();
  const link = document.createElement('a');
  link.download = `${safeTitle || 'lyrics'}.jpg`;
  link.href = dataUrl;
  link.click();
}
