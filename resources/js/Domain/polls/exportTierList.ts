import { TIERS, TIER_KEYS, type TierKey } from "@/Domain/polls/tiers";
import { resolveShareBrandTokens } from "@/Lib/theme";

export type ExportTierDataOptions = {
    tiers: Record<TierKey, Array<{ name: string; title?: string | null; imageUrl?: string | null }>>;
    basePath?: string;
    fileName?: string;
    width?: number;
    scale?: number;
    watermarkText?: string;
    themeId?: string;
    groupName?: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
        const img = new Image();
        if (/^https?:\/\//i.test(src)) {
            img.crossOrigin = "anonymous";
        }
        (img as HTMLImageElement & { decoding?: string }).decoding = "sync";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = src;
    });
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

export async function renderTierListFile(options: ExportTierDataOptions): Promise<File> {
    const {
        tiers,
        fileName = "tier-list.png",
        width = 1000,
        scale = 2,
        watermarkText = "syrian.zone/tierlist",
        themeId = "nili",
        groupName,
    } = options;

    const tokens = resolveShareBrandTokens(themeId);
    if (typeof document !== "undefined" && document.fonts) {
        try {
            await document.fonts.ready;
        } catch {
            /* ignore */
        }
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const transcodedUrls: string[] = [];
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";

    function resolveUrl(u: string): string {
        if (!u) return u;
        if (u.startsWith("http://") || u.startsWith("https://")) return u;
        if (u.startsWith("/")) return `${origin}${u}`;
        return u;
    }

    async function transcodeToDataUrl(
        url: string,
        targetW: number,
        targetH: number,
        mode: "cover" | "contain" = "cover",
    ): Promise<string | undefined> {
        try {
            const abs = resolveUrl(url);
            const res = await fetch(abs, { cache: "no-store", mode: "cors" });
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
            let canvasW = targetW;
            let canvasH = targetH;
            if (mode === "contain") {
                if (targetW <= 0 && targetH > 0 && srcH > 0) {
                    canvasH = targetH;
                    canvasW = Math.max(1, Math.round((srcW / srcH) * canvasH));
                } else if (targetH <= 0 && targetW > 0 && srcW > 0) {
                    canvasW = targetW;
                    canvasH = Math.max(1, Math.round((srcH / srcW) * canvasW));
                }
            }
            const off = document.createElement("canvas");
            off.width = Math.max(1, canvasW);
            off.height = Math.max(1, canvasH);
            const octx = off.getContext("2d");
            if (!octx) return undefined;
            octx.fillStyle = tokens.card;
            octx.fillRect(0, 0, off.width, off.height);
            if (mode === "cover") {
                const minSide = Math.max(1, Math.min(srcW, srcH));
                const sx = Math.floor((srcW - minSide) / 2);
                const sy = Math.floor((srcH - minSide) / 2);
                octx.drawImage(img, sx, sy, minSide, minSide, 0, 0, off.width, off.height);
            } else {
                const ratio = Math.min(off.width / srcW, off.height / srcH);
                const dw = Math.round(srcW * ratio);
                const dh = Math.round(srcH * ratio);
                const dx = Math.floor((off.width - dw) / 2);
                const dy = Math.floor((off.height - dh) / 2);
                octx.drawImage(img, dx, dy, dw, dh);
            }
            const out = await new Promise<Blob | null>((resolve) => off.toBlob(resolve, "image/jpeg", 0.94));
            if (!out) return undefined;
            const outUrl = URL.createObjectURL(out);
            transcodedUrls.push(outUrl);
            return outUrl;
        } catch {
            return undefined;
        }
    }

    function swapExtension(u: string, ext: string): string {
        return u.replace(/\.(avif|webp|png|jpg|jpeg)$/i, `.${ext}`);
    }

    async function loadBestImageDataUrl(src: string, targetW: number, targetH: number): Promise<string | undefined> {
        let data = await transcodeToDataUrl(src, targetW, targetH, "cover");
        if (data) return data;
        const candidates: string[] = [];
        if (/\.(avif)$/i.test(src)) {
            candidates.push(swapExtension(src, "jpg"), swapExtension(src, "jpeg"), swapExtension(src, "png"));
        } else if (/\.(webp)$/i.test(src)) {
            candidates.push(swapExtension(src, "jpg"), swapExtension(src, "png"));
        }
        for (const c of candidates) {
            data = await transcodeToDataUrl(c, targetW, targetH, "cover");
            if (data) return data;
        }
        return undefined;
    }

    const bodyFont = '"IBM Plex Sans Arabic", system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    const displayFont = '"Beiruti", "IBM Plex Sans Arabic", system-ui, sans-serif';
    const monoFont = 'ui-monospace, SFMono-Regular, Menlo, monospace';

    const railWidth = 8;
    const padding = { top: 20, right: 24 + railWidth, bottom: 18, left: 24 };
    const headerH = 62;
    const footerH = 48;
    const labelWidth = 92;
    const rowGap = 8;
    const itemWidth = 120;
    const itemHeight = 160;
    const itemGap = 8;
    const internalRowGap = 10;
    const tierTopPad = 10;
    const tierBottomPad = 10;

    const finalWidth = Math.max(width, 640);
    const areaW = finalWidth - padding.left - padding.right - labelWidth;
    const maxPerRow = Math.max(1, Math.floor((areaW + itemGap) / (itemWidth + itemGap)));

    const tierHeights: Record<TierKey, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    let contentHeight = 0;
    for (const k of TIER_KEYS) {
        const count = (tiers[k] || []).length;
        const rows = Math.max(1, Math.ceil(count / maxPerRow));
        const blockHeight = tierTopPad + rows * itemHeight + (rows - 1) * internalRowGap + tierBottomPad;
        tierHeights[k] = blockHeight;
        contentHeight += blockHeight;
    }

    const height =
        padding.top +
        headerH +
        14 +
        contentHeight +
        rowGap * (TIER_KEYS.length - 1) +
        16 +
        footerH +
        padding.bottom;

    canvas.width = Math.floor(finalWidth * scale);
    canvas.height = Math.floor(height * scale);
    ctx.scale(scale, scale);

    // Madar ground
    ctx.fillStyle = tokens.ground;
    ctx.fillRect(0, 0, finalWidth, height);

    // Right-edge Madar primary rail + saffron node notch
    ctx.fillStyle = tokens.primary;
    ctx.fillRect(finalWidth - railWidth, 0, railWidth, height);
    ctx.fillStyle = tokens.node;
    ctx.fillRect(finalWidth - railWidth, padding.top + 8, railWidth, 32);

    try {
        (ctx as CanvasRenderingContext2D & { direction?: string }).direction = "rtl";
    } catch {
        /* ignore */
    }

    // Header bar
    const headerCenterY = padding.top + headerH / 2 - 4;
    const rightEdge = finalWidth - padding.right;

    // Saffron node indicator + Madar wordmark title
    ctx.fillStyle = tokens.node;
    drawRoundedRect(ctx, rightEdge - 14, headerCenterY - 7, 14, 14, 4);
    ctx.fill();

    ctx.fillStyle = tokens.ink;
    ctx.font = `800 24px ${displayFont}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("المساحة السورية", rightEdge - 24, headerCenterY);

    // Module pill on the left (RTL end)
    const pillText = groupName ? `تقييم: ${groupName}` : "قائمة التقييم";
    ctx.font = `700 13px ${bodyFont}`;
    const pillTextW = ctx.measureText(pillText).width;
    const pillW = pillTextW + 24;
    const pillH = 28;
    const pillX = padding.left;
    const pillY = headerCenterY - pillH / 2;
    ctx.fillStyle = tokens.card;
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tokens.primary;
    ctx.textAlign = "center";
    ctx.fillText(pillText, pillX + pillW / 2, headerCenterY);

    // Header rule
    const headerBottomY = padding.top + headerH;
    ctx.fillStyle = tokens.border;
    ctx.fillRect(padding.left, headerBottomY, finalWidth - padding.left - padding.right, 1);

    // Load avatars
    const loaded: Map<string, HTMLImageElement> = new Map();
    const toLoad: string[] = [];
    for (const k of TIER_KEYS) {
        for (const it of tiers[k] || []) {
            const u = it.imageUrl || "";
            if (!u) continue;
            const abs = resolveUrl(u);
            if (!loaded.has(abs)) toLoad.push(abs);
        }
    }
    await Promise.all(
        toLoad.map(async (srcAbs) => {
            const dataUrl = await loadBestImageDataUrl(srcAbs, 256, 256);
            if (!dataUrl) return;
            const img = await loadImage(dataUrl);
            loaded.set(srcAbs, img);
        }),
    );

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    function wrapText(text: string, maxWidthPx: number): string[] {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (ctx.measureText(test).width > maxWidthPx && line) {
                lines.push(line);
                line = w;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines.slice(0, 2);
    }

    let y = headerBottomY + 14;
    for (const k of TIER_KEYS) {
        const items = tiers[k] || [];
        const blockHeight = tierHeights[k];

        // Tier label block (placed on RTL start = right side)
        const labelX = finalWidth - padding.right - labelWidth;
        ctx.fillStyle = TIERS[k].color;
        drawRoundedRect(ctx, labelX, y, labelWidth, blockHeight, 8);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 24px ${displayFont}`;
        ctx.fillText(k, labelX + labelWidth / 2, y + blockHeight / 2 - 14);
        ctx.font = `700 15px ${bodyFont}`;
        ctx.fillText(TIERS[k].arabic, labelX + labelWidth / 2, y + blockHeight / 2 + 14);

        // Tier drop area on the left of the label
        const areaX = padding.left;
        const areaWFull = finalWidth - padding.left - padding.right - labelWidth - 6;
        ctx.save();
        ctx.fillStyle = tokens.isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.55)";
        drawRoundedRect(ctx, areaX, y, areaWFull, blockHeight, 8);
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = tokens.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const total = items.length;
        for (let idx = 0; idx < total; idx++) {
            const rowIndex = Math.floor(idx / maxPerRow);
            const colIndex = idx % maxPerRow;
            const itemsInRow = Math.min(maxPerRow, total - rowIndex * maxPerRow);
            const rowContentWidth = itemsInRow * itemWidth + (itemsInRow - 1) * itemGap;
            const rowStartX = areaX + Math.max(0, Math.floor((areaWFull - rowContentWidth) / 2));
            const cx = rowStartX + colIndex * (itemWidth + itemGap);
            const cy = y + tierTopPad + rowIndex * (itemHeight + internalRowGap);
            const it = items[idx];

            ctx.fillStyle = tokens.card;
            ctx.strokeStyle = tokens.border;
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, cx, cy, itemWidth, itemHeight, 8);
            ctx.fill();
            ctx.stroke();

            const imgSrc = it.imageUrl || "";
            const imgKey = resolveUrl(imgSrc);
            const img = imgKey ? loaded.get(imgKey) : undefined;
            if (img && img.width && img.height) {
                const iw = 96;
                const ih = 96;
                const ix = cx + Math.floor((itemWidth - iw) / 2);
                const iy = cy + 8;
                ctx.save();
                drawRoundedRect(ctx, ix, iy, iw, ih, 6);
                ctx.clip();
                const srcW = img.naturalWidth || img.width;
                const srcH = img.naturalHeight || img.height;
                const minSide = Math.max(1, Math.min(srcW, srcH));
                const sx = Math.floor((srcW - minSide) / 2);
                const sy = Math.floor((srcH - minSide) / 2);
                ctx.drawImage(img, sx, sy, minSide, minSide, ix, iy, iw, ih);
                ctx.restore();
            } else {
                ctx.fillStyle = tokens.mutedSurface;
                drawRoundedRect(ctx, cx + 12, cy + 8, 96, 96, 6);
                ctx.fill();
            }

            ctx.fillStyle = tokens.ink;
            ctx.font = `700 13px ${bodyFont}`;
            const lines = wrapText(it.name || "", itemWidth - 12);
            lines.forEach((ln, i) => {
                ctx.fillText(ln, cx + itemWidth / 2, cy + 114 + i * 15);
            });
            if (it.title) {
                ctx.fillStyle = tokens.muted;
                ctx.font = `500 11.5px ${bodyFont}`;
                const tlines = wrapText(it.title, itemWidth - 12);
                tlines.forEach((ln, i) => {
                    ctx.fillText(ln, cx + itemWidth / 2, cy + 114 + lines.length * 15 + 4 + i * 13);
                });
            }
        }

        y += blockHeight + rowGap;
    }

    // Footer rule & Madar attribution
    const footerTopY = y + 8;
    ctx.fillStyle = tokens.border;
    ctx.fillRect(padding.left, footerTopY, finalWidth - padding.left - padding.right, 1);

    const footerMidY = footerTopY + footerH / 2;
    ctx.fillStyle = tokens.muted;
    ctx.font = `600 13px ${bodyFont}`;
    ctx.textAlign = "right";
    ctx.fillText("المساحة السورية", rightEdge, footerMidY);

    try {
        (ctx as CanvasRenderingContext2D & { direction?: string }).direction = "ltr";
    } catch {
        /* ignore */
    }
    ctx.fillStyle = tokens.primary;
    ctx.font = `700 14px ${monoFont}`;
    ctx.textAlign = "left";
    ctx.fillText(watermarkText, padding.left, footerMidY);

    try {
        transcodedUrls.forEach((u) => URL.revokeObjectURL(u));
    } catch {
        /* ignore */
    }

    const encode = (type: string, quality?: number) =>
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await encode("image/png");
    let ext = "png";
    let mime = "image/png";
    if (!blob) {
        blob = await encode("image/jpeg", 0.95);
        ext = "jpg";
        mime = "image/jpeg";
    }
    if (!blob) throw new Error("tier list image could not be encoded");

    const base = fileName.replace(/\.(png|jpe?g)$/i, "") || "tier-list";
    return new File([blob], `${base}.${ext}`, { type: mime });
}

export async function exportTierListFromData(options: ExportTierDataOptions): Promise<void> {
    const file = await renderTierListFile(options);
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.download = file.name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
