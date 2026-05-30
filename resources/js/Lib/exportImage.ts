import html2canvas from "html2canvas";

type ExportOptions = {
    container: HTMLElement;
    targetWidthPx?: number;
    basePath?: string;
    logoSrc?: string;
    watermarkText?: string;
    fileName?: string;
    scale?: number;
};

type TierKey = "S" | "A" | "B" | "C" | "D" | "F";

type ExportTierDataOptions = {
    tiers: Record<TierKey, Array<{ name: string; title?: string | null; imageUrl?: string | null }>>;
    basePath?: string;
    fileName?: string;
    width?: number;
    scale?: number;
    watermarkText?: string;
    logoSrc?: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
        const img = new Image();
        // Only set crossOrigin for network URLs; data:/blob: don't need it and some browsers mishandle it
        if (/^https?:\/\//i.test(src)) {
            img.crossOrigin = "anonymous";
        }
        (img as any).decoding = "sync";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = src;
    });
}

export async function exportTierListFromData(options: ExportTierDataOptions): Promise<void> {
    const {
        tiers,
        basePath = "",
        fileName = "tier-list.png",
        width = 1000,
        scale = 2,
        watermarkText = "syrian.zone/tierlist",
        logoSrc = (typeof window !== "undefined" ? `/assets/logo-lightmode.svg` : "/assets/logo-lightmode.svg"),
    } = options;

    const tierOrder: TierKey[] = ["S", "A", "B", "C", "D", "F"];
    const tierLabel: Record<TierKey, string> = { S: "S", A: "A", B: "B", C: "C", D: "D", F: "F" };
    const tierArabic: Record<TierKey, string> = { S: "ممتاز", A: "جيد جدًا", B: "جيد", C: "مقبول", D: "ضعيف", F: "سيئ" };
    const tierColor: Record<TierKey, string> = {
        S: "#e11d48",
        A: "#d97706",
        B: "#059669",
        C: "#0284c7",
        D: "#7c3aed",
        F: "#1f2937",
    };

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "";
    function resolveUrl(u: string): string {
        if (!u) return u;
        if (u.startsWith("http://") || u.startsWith("https://")) return u;
        if (u.startsWith("/")) return `${origin}${u}`;
        return u;
    }
    // Transcode a remote image URL into a JPEG data URL for reliable canvas rendering (iOS Safari)
    async function transcodeToDataUrl(url: string, targetW: number, targetH: number, mode: "cover" | "contain" = "cover"): Promise<string | undefined> {
        try {
            const abs = resolveUrl(url);
            // Always fetch via same-origin proxy to avoid CORS/taint and iOS Safari canvas issues
            // Update proxy URL if needed, assuming /api/image-proxy exists or just try fetching directly if cors allows
            // For now we assume we might need to fix this proxy part or use a different approach if API is different
            // Let's assume direct fetch for now or use original path
            const proxied = abs; // `${origin}${basePath}/api/image-proxy?fit=${mode}&w=${targetW || 0}&h=${targetH || 0}&url=${encodeURIComponent(abs)}`;

            // Temporary: try direct fetch first
            const res = await fetch(proxied, { cache: "no-store", mode: 'cors' });
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
            const srcW = (img as any).naturalWidth || img.width;
            const srcH = (img as any).naturalHeight || img.height;
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
            // white background to avoid transparent issues in JPEG
            octx.fillStyle = "#ffffff";
            octx.fillRect(0, 0, off.width, off.height);
            if (mode === "cover") {
                const minSide = Math.max(1, Math.min(srcW, srcH));
                const sx = Math.floor((srcW - minSide) / 2);
                const sy = Math.floor((srcH - minSide) / 2);
                octx.drawImage(img, sx, sy, minSide, minSide, 0, 0, off.width, off.height);
            } else {
                // contain: center fit
                const ratio = Math.min(off.width / srcW, off.height / srcH);
                const dw = Math.round(srcW * ratio);
                const dh = Math.round(srcH * ratio);
                const dx = Math.floor((off.width - dw) / 2);
                const dy = Math.floor((off.height - dh) / 2);
                octx.drawImage(img, dx, dy, dw, dh);
            }
            return off.toDataURL("image/jpeg", 0.95);
        } catch {
            return undefined;
        }
    }

    function swapExtension(u: string, ext: string): string {
        return u.replace(/\.(avif|webp|png|jpg|jpeg)$/i, `.${ext}`);
    }

    async function loadBestImageDataUrl(src: string, targetW: number, targetH: number, mode: "cover" | "contain" = "cover"): Promise<string | undefined> {
        // Try original
        let data = await transcodeToDataUrl(src, targetW, targetH, mode);
        if (data) return data;
        // Try common fallbacks for formats Safari may not decode
        const candidates: string[] = [];
        if (/\.(avif)$/i.test(src)) {
            candidates.push(swapExtension(src, "jpg"), swapExtension(src, "jpeg"), swapExtension(src, "png"));
        } else if (/\.(webp)$/i.test(src)) {
            candidates.push(swapExtension(src, "jpg"), swapExtension(src, "png"));
        }
        for (const c of candidates) {
            data = await transcodeToDataUrl(c, targetW, targetH, mode);
            if (data) return data;
        }
        return undefined;
    }
    // Local safe image loader: fetch as blob and use object URL to improve cross-browser reliability (iOS Safari)
    const objectUrls: string[] = [];
    async function loadImageSafe(url: string): Promise<HTMLImageElement | undefined> {
        try {
            const res = await fetch(url, { cache: "force-cache", mode: "cors" as RequestMode });
            if (!res.ok) return undefined;
            const blob = await res.blob();
            const objUrl = URL.createObjectURL(blob);
            objectUrls.push(objUrl);
            const img = new Image();
            (img as any).decoding = "sync";
            // iOS Safari sometimes needs a small defer before assigning src for blob URLs
            await new Promise((r) => setTimeout(r, 0));
            await new Promise((resolve) => {
                img.onload = () => resolve(null);
                img.onerror = () => resolve(null);
                img.src = objUrl;
            });
            return img;
        } catch {
            return undefined;
        }
    }

    // Fonts
    const fontFamily = 'IBM Plex Sans Arabic, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

    // Measure footer (text + logo) to expand canvas width if needed to avoid cropping
    const footerFont = "bold 16px " + fontFamily;
    const measureCtx = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
    measureCtx.font = footerFont;
    const footerTextWidth = measureCtx.measureText(watermarkText).width;
    const footerGap = 12;
    const footerLogoW = 32;
    const footerMinWidth = Math.ceil(footerTextWidth + footerGap + footerLogoW + 40);
    const finalWidth = Math.max(width, footerMinWidth);

    const padding = { top: 16, right: 16, bottom: 16, left: 16 };
    const labelWidth = 90;
    const rowGap = 8; // gap between tiers
    const itemWidth = 120;
    const itemHeight = 160;
    const itemGap = 8; // horizontal gap between items
    const internalRowGap = 10; // vertical gap between rows inside the same tier
    const tierTopPad = 10;
    const tierBottomPad = 10;

    // Pre-compute dynamic height based on content
    const areaW = finalWidth - padding.left - padding.right - labelWidth;
    const maxPerRow = Math.max(1, Math.floor((areaW + itemGap) / (itemWidth + itemGap)));
    const tierHeights: Record<TierKey, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    let contentHeight = 0;
    for (const k of tierOrder) {
        const count = (tiers[k] || []).length;
        const rows = Math.max(1, Math.ceil(count / maxPerRow));
        const blockHeight = tierTopPad + rows * itemHeight + (rows - 1) * internalRowGap + tierBottomPad;
        tierHeights[k] = blockHeight;
        contentHeight += blockHeight;
    }
    const watermarkH = 64;
    const height = padding.top + contentHeight + rowGap * (tierOrder.length - 1) + padding.bottom + watermarkH;
    canvas.width = Math.floor(finalWidth * scale);
    canvas.height = Math.floor(height * scale);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalWidth, height);
    // Enforce RTL rendering
    try { (ctx as any).direction = "rtl"; } catch { }
    const rtl = (s: string) => s;
    ctx.font = "14px " + fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    function wrapText(text: string, maxWidthPx: number, lineHeight: number): string[] {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
            const test = line ? line + " " + w : w;
            const m = ctx.measureText(test);
            if (m.width > maxWidthPx && line) {
                lines.push(line);
                line = w;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines.slice(0, 2);
    }

    const loaded: Map<string, HTMLImageElement> = new Map();
    const toLoad: string[] = [];
    for (const k of tierOrder) {
        for (const it of tiers[k] || []) {
            const u = it.imageUrl || "";
            if (!u) continue;
            const abs = resolveUrl(u);
            if (!loaded.has(abs)) toLoad.push(abs);
        }
    }
    await Promise.all(
        toLoad.map(async (srcAbs) => {
            // Transcode avatars to a square JPEG to avoid CORS/taint issues and format incompatibilities
            const dataUrl = await loadBestImageDataUrl(srcAbs, 256, 256, "cover");
            if (!dataUrl) return;
            const img = await loadImage(dataUrl);
            loaded.set(srcAbs, img);
        })
    );

    let y = padding.top;
    for (const k of tierOrder) {
        const items = tiers[k] || [];
        const blockHeight = tierHeights[k];
        ctx.fillStyle = tierColor[k];
        ctx.fillRect(padding.left, y, labelWidth, blockHeight);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px " + fontFamily;
        ctx.fillText(rtl(tierLabel[k]), padding.left + labelWidth / 2, y + 24);
        // Arabic label under the letter
        ctx.font = "600 16px " + fontFamily;
        ctx.fillText(rtl(tierArabic[k]), padding.left + labelWidth / 2, y + 52);
        ctx.font = "600 14px " + fontFamily;
        const areaX = padding.left + labelWidth;
        // Dotted (dashed) border around the tier area
        const areaY = y;
        const areaWFull = finalWidth - padding.left - padding.right - labelWidth;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 2;
        ctx.strokeRect(areaX, areaY, areaWFull, blockHeight);
        ctx.restore();
        // Draw items centered per row; compute rows and place each item by (rowIndex, colIndex)
        const total = items.length;
        const rows = Math.max(1, Math.ceil(total / maxPerRow));
        for (let idx = 0; idx < total; idx++) {
            const rowIndex = Math.floor(idx / maxPerRow);
            const colIndex = idx % maxPerRow;
            const itemsInRow = Math.min(maxPerRow, total - rowIndex * maxPerRow);
            const rowContentWidth = itemsInRow * itemWidth + (itemsInRow - 1) * itemGap;
            const rowStartX = areaX + Math.max(0, Math.floor((areaW - rowContentWidth) / 2));
            const cx = rowStartX + colIndex * (itemWidth + itemGap);
            const cy = y + tierTopPad + rowIndex * (itemHeight + internalRowGap);
            const it = items[idx];
            // Card
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#e5e7eb";
            ctx.lineWidth = 1;
            ctx.fillRect(cx, cy, itemWidth, itemHeight);
            ctx.strokeRect(cx, cy, itemWidth, itemHeight);

            // Image
            const imgSrc = it.imageUrl || "";
            const imgKey = resolveUrl(imgSrc);
            const img = imgKey ? loaded.get(imgKey) : undefined;
            if (img && img.width && img.height) {
                const iw = 96;
                const ih = 96;
                const ix = cx + Math.floor((itemWidth - iw) / 2);
                const iy = cy + 8;
                ctx.save();
                ctx.beginPath();
                const r = 6;
                ctx.moveTo(ix + r, iy);
                ctx.arcTo(ix + iw, iy, ix + iw, iy + ih, r);
                ctx.arcTo(ix + iw, iy + ih, ix, iy + ih, r);
                ctx.arcTo(ix, iy + ih, ix, iy, r);
                ctx.arcTo(ix, iy, ix + iw, iy, r);
                ctx.closePath();
                ctx.clip();
                // Crop like object-fit: cover (center square crop)
                const srcW = (img as any).naturalWidth || img.width;
                const srcH = (img as any).naturalHeight || img.height;
                const minSide = Math.max(1, Math.min(srcW, srcH));
                const sx = Math.floor((srcW - minSide) / 2);
                const sy = Math.floor((srcH - minSide) / 2);
                ctx.drawImage(img, sx, sy, minSide, minSide, ix, iy, iw, ih);
                ctx.restore();
            } else {
                ctx.fillStyle = "#f3f4f6";
                ctx.fillRect(cx + 12, cy + 12, 96, 96);
            }

            // Texts
            ctx.fillStyle = "#111111";
            ctx.font = "600 12px " + fontFamily;
            const lines = wrapText(it.name ? rtl(it.name) : "", itemWidth - 12, 14);
            lines.forEach((ln, i) => {
                ctx.fillText(ln, cx + itemWidth / 2, cy + 112 + i * 14);
            });
            if (it.title) {
                ctx.font = "12px " + fontFamily;
                const tlines = wrapText(rtl(it.title), itemWidth - 12, 12);
                tlines.forEach((ln, i) => {
                    ctx.fillText(ln, cx + itemWidth / 2, cy + 112 + lines.length * 14 + 4 + i * 12);
                });
            }

        }

        y += blockHeight + rowGap;
    }

    // Watermark with logo to the right of URL
    ctx.fillStyle = "#111111";
    ctx.font = "bold 16px " + fontFamily;
    const gap = 12;
    const textWidth = ctx.measureText(watermarkText).width;
    let logoImg: HTMLImageElement | undefined;
    try {
        const src = logoSrc.startsWith("/") ? `${basePath}${logoSrc}` : logoSrc;
        const logoDataUrl = await transcodeToDataUrl(src, 0, 32, "contain");
        if (logoDataUrl) logoImg = await loadImage(logoDataUrl);
    } catch { }
    const logoH = 32;
    let logoDrawW = 0;
    if (logoImg) {
        const sW = (logoImg as any).naturalWidth || logoImg.width || logoH;
        const sH = (logoImg as any).naturalHeight || logoImg.height || logoH;
        const ratio = sH > 0 ? (logoH / sH) : 1;
        logoDrawW = Math.max(1, Math.round(sW * ratio));
    }
    const totalW = textWidth + (logoImg ? gap + logoDrawW : 0);
    const startX = Math.max(10, Math.floor((finalWidth - totalW) / 2));
    const footerTop = height - (padding.bottom + watermarkH);
    const by = footerTop + Math.floor(watermarkH / 2);
    const prevAlign = ctx.textAlign;
    const prevDir = (ctx as any).direction;
    try { (ctx as any).direction = "ltr"; } catch { }
    ctx.textAlign = "left";
    ctx.fillText(watermarkText, startX, by);
    if (logoImg && logoDrawW > 0) {
        const lx = startX + textWidth + gap;
        const ly = by - Math.floor(logoH / 2);
        // Draw full logo preserving aspect ratio (no crop)
        ctx.drawImage(logoImg, lx, ly, logoDrawW, logoH);
    }
    ctx.textAlign = prevAlign;
    try { (ctx as any).direction = prevDir; } catch { }

    // Revoke any object URLs created during loading
    try { objectUrls.forEach((u) => URL.revokeObjectURL(u)); } catch { }

    // Prefer image/jpeg for better Safari compatibility; fallback to png if needed
    const dataUrl = (() => {
        try { return canvas.toDataURL("image/jpeg", 0.95); } catch { return canvas.toDataURL("image/png"); }
    })();
    const link = document.createElement("a");
    link.download = fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? fileName : "tier-list.jpg";
    link.href = dataUrl;
    link.click();
}

export async function exportTierListImage(options: ExportOptions): Promise<void> {
    const {
        container,
        targetWidthPx = 1000,
        basePath = "",
        logoSrc =
        (typeof window !== "undefined" ? `/assets/logo-lightmode.svg` : "/assets/logo-lightmode.svg"),
        watermarkText = "syrian.zone/tierlist",
        fileName = "tier-list.png",
        scale = 2,
    } = options;

    const cloneContainer = container.cloneNode(true) as HTMLElement;
    cloneContainer.setAttribute("data-capture-export", "1");

    const srcPadding = window.getComputedStyle(container).padding;
    cloneContainer.style.position = "absolute";
    cloneContainer.style.left = "-9999px";
    cloneContainer.style.top = "0px";
    cloneContainer.style.width = `${targetWidthPx}px`;
    cloneContainer.style.height = "auto";
    cloneContainer.style.display = "block";
    cloneContainer.style.backgroundColor = "#ffffff";
    cloneContainer.style.padding = srcPadding;
    cloneContainer.style.boxShadow = "none";

    cloneContainer.querySelectorAll<HTMLElement>("[data-tier-area]").forEach((zone) => {
        zone.style.border = "1px solid #eee";
        zone.style.backgroundColor = "#fdfdfd";
        zone.style.borderStyle = "solid";
    });

    cloneContainer.querySelectorAll<HTMLElement>("button").forEach((item) => {
        item.style.width = "100px";
        item.style.height = "160px";
        item.style.padding = "5px";
        item.style.boxSizing = "border-box";
        item.style.border = "1px solid #ddd";
        item.style.borderRadius = "4px";
        item.style.backgroundColor = "#ffffff";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        (item.style as any).justifyContent = "normal";
        item.style.alignItems = "center";
        item.style.overflow = "hidden";

        const img = item.querySelector("img") as HTMLImageElement | null;
        if (img) {
            img.style.width = "95px";
            img.style.height = "95px";
            img.style.objectFit = "cover";
            img.style.marginBottom = "5px";
            (img.style as any).userSelect = "none";
            (img.style as any).pointerEvents = "none";
        }

        item.querySelectorAll("span").forEach((p) => {
            const el = p as HTMLElement;
            el.style.fontSize = "0.75rem";
            el.style.lineHeight = "1.2";
            el.style.margin = "0";
            el.style.textAlign = "center";
            el.style.overflow = "visible";
            (el.style as any).textOverflow = "ellipsis";
            el.style.whiteSpace = "normal";
            (el.style as any).wordBreak = "break-word";
            el.style.maxHeight = "4em";
        });
    });

    const wmFontSize = Math.max(32, Math.floor(targetWidthPx * 0.018));
    const footer = document.createElement("div");
    footer.setAttribute("data-capture-watermark", "1");
    footer.style.position = "absolute";
    footer.style.left = "0";
    footer.style.right = "0";
    footer.style.bottom = "0";
    footer.style.width = "100%";
    footer.style.zIndex = "2147483647";
    footer.style.pointerEvents = "none";
    footer.style.padding = "8px 12px";
    footer.style.display = "flex";
    footer.style.flexDirection = "row";
    footer.style.alignItems = "center";
    footer.style.justifyContent = "center";
    footer.style.gap = "12px";
    footer.style.fontWeight = "600";
    footer.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    footer.style.fontSize = `${wmFontSize}px`;

    const textEl = document.createElement("div");
    textEl.textContent = watermarkText;
    footer.style.setProperty("color", "#111111", "important");

    let resolvedLogoDataUrl = "";
    try {
        const res = await fetch(logoSrc, { cache: "force-cache" });
        const contentType = res.headers.get("content-type") || "";
        if (res.ok) {
            if (contentType.includes("image/svg") || logoSrc.endsWith(".svg")) {
                const svgText = await res.text();
                try {
                    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
                    const svgUrl = URL.createObjectURL(svgBlob);
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = svgUrl;
                    await new Promise((resolve) => {
                        img.onload = () => resolve(null);
                        img.onerror = () => resolve(null);
                    });
                    const targetWidthPx = Math.max(150, Math.floor(wmFontSize * 1.25));
                    const naturalW = img.naturalWidth || targetWidthPx;
                    const naturalH = img.naturalHeight || targetWidthPx;
                    const ratio = targetWidthPx / naturalW;
                    const targetHeightPx = Math.max(1, Math.round(naturalH * ratio));
                    const c = document.createElement("canvas");
                    c.width = targetWidthPx;
                    c.height = targetHeightPx;
                    const ctx = c.getContext("2d");
                    if (ctx) {
                        ctx.clearRect(0, 0, c.width, c.height);
                        ctx.drawImage(img, 0, 0, c.width, c.height);
                        resolvedLogoDataUrl = c.toDataURL("image/png");
                    }
                    URL.revokeObjectURL(svgUrl);
                } catch { }
            } else {
                const blob = await res.blob();
                resolvedLogoDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }
        }
    } catch { }
    if (!resolvedLogoDataUrl) {
        resolvedLogoDataUrl = logoSrc;
    }

    const logoImg = document.createElement("img");
    logoImg.crossOrigin = "anonymous";
    (logoImg as any).referrerPolicy = "no-referrer";
    (logoImg as any).decoding = "sync";
    (logoImg as any).loading = "eager";
    (logoImg.style as any).userSelect = "none";
    (logoImg.style as any).pointerEvents = "none";
    logoImg.src = resolvedLogoDataUrl;
    logoImg.alt = "Logo";
    logoImg.style.width = `${Math.max(150, Math.floor(wmFontSize * 1.25))}px`;
    logoImg.style.height = "auto";
    logoImg.style.display = "block";

    footer.appendChild(textEl);
    footer.appendChild(logoImg);
    cloneContainer.appendChild(footer);

    try {
        try {
            if (typeof (logoImg as any).decode === "function") {
                await (logoImg as any).decode();
            } else {
                await new Promise((resolve) => {
                    logoImg.onload = () => resolve(null);
                    logoImg.onerror = () => resolve(null);
                });
            }
        } catch { }
        const computed = window.getComputedStyle(cloneContainer);
        const currentPadBottom = parseInt(computed.paddingBottom, 10) || 0;
        const footerHeight = Math.ceil(footer.getBoundingClientRect().height) || Math.ceil(wmFontSize * 1.8);
        cloneContainer.style.paddingBottom = `${currentPadBottom + footerHeight}px`;
    } catch { }

    const tempStyle = document.createElement("style");
    tempStyle.setAttribute("data-capture-style", "1");
    tempStyle.textContent = `
[data-capture-export] * { 
  background: none !important;
  background-image: none !important;
  text-shadow: none !important;
  box-shadow: none !important;
}
[data-capture-export], [data-capture-export] * {
  background-color: #ffffff !important;
  color: #111111 !important;
  border-color: #e5e7eb !important;
  outline-color: #e5e7eb !important;
}`;
    document.head.appendChild(tempStyle);
    document.body.appendChild(cloneContainer);

    try {
        await (document as any).fonts?.ready;
        const canvas = await html2canvas(cloneContainer, {
            backgroundColor: "#ffffff",
            logging: true,
            useCORS: true,
            width: targetWidthPx,
            allowTaint: false,
            scale,
            onclone: (clonedDoc: Document) => {
                const styleEl = clonedDoc.createElement('style');
                styleEl.textContent = `
[data-capture-export] * { 
  background: none !important;
  background-image: none !important;
  text-shadow: none !important;
  box-shadow: none !important;
}
[data-capture-export], [data-capture-export] * {
  background-color: #ffffff !important;
  color: #111111 !important;
  border-color: #e5e7eb !important;
  outline-color: #e5e7eb !important;
}`;
                clonedDoc.head.appendChild(styleEl);
                clonedDoc.documentElement.style.background = '#ffffff';
                clonedDoc.body.style.background = '#ffffff';
                const root = clonedDoc.querySelector('[data-capture-export="1"]') as HTMLElement | null;
                const win = clonedDoc.defaultView || window;
                const containsModern = (v: string | null) => !!v && (v.includes('lab(') || v.includes('oklch') || v.includes('color-mix(') || v.includes('color('));
                const scrub = (el: HTMLElement) => {
                    const cs = win.getComputedStyle(el);
                    if (containsModern(cs.background) || containsModern(cs.backgroundImage) || containsModern(cs.backgroundColor)) {
                        el.style.setProperty('background', 'none', 'important');
                        el.style.setProperty('background-image', 'none', 'important');
                        el.style.setProperty('background-color', '#ffffff', 'important');
                    }
                    if (containsModern(cs.color)) {
                        el.style.setProperty('color', '#111111', 'important');
                    }
                    if (containsModern(cs.borderColor)) {
                        el.style.setProperty('border-color', '#e5e7eb', 'important');
                    }
                    if (containsModern(cs.outlineColor)) {
                        el.style.setProperty('outline-color', '#e5e7eb', 'important');
                    }
                };
                if (root) {
                    scrub(root);
                    root.querySelectorAll<HTMLElement>('*').forEach(scrub);
                    const labelColorMap: Record<string, string> = {
                        S: '#e11d48',
                        A: '#d97706',
                        B: '#059669',
                        C: '#0284c7',
                        D: '#7c3aed',
                        F: '#1f2937',
                    };
                    root.querySelectorAll<HTMLElement>('[data-tier-label]').forEach((el) => {
                        const key = el.getAttribute('data-tier-label') || '';
                        const color = labelColorMap[key] || '#111111';
                        el.style.setProperty('background', 'none', 'important');
                        el.style.setProperty('background-image', 'none', 'important');
                        el.style.setProperty('background-color', color, 'important');
                        el.style.setProperty('color', '#ffffff', 'important');
                    });
                }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const link = document.createElement("a");
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
    } finally {
        if (document.body.contains(cloneContainer)) {
            document.body.removeChild(cloneContainer);
        }
        const injected = document.querySelector('style[data-capture-style="1"]');
        if (injected && injected.parentNode) {
            injected.parentNode.removeChild(injected);
        }
    }
}
