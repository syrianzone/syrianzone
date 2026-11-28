import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowsUpFromLine, Palette, MapPin, Download, Info, Globe, Trash2, Plus, Share2 } from 'lucide-react';
import { Twitter } from '@/Components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { confirmDialog } from '@/Lib/confirm';
import BrandShareFrame, { MADAR_DISPLAY_FONT } from '@/Components/share/BrandShareFrame';
import ShareImageDialog from '@/Components/share/ShareImageDialog';

interface Dot {
    id: number;
    x: number;
    y: number;
    color: string;
    name: string;
}

interface Axes {
    left: string;
    right: string;
    top: string;
    bottom: string;
}

interface Colors {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
}

const DEFAULT_AXES: Axes = {
    left: 'اقتصادي',
    right: 'ليبرالي',
    top: 'محافظ',
    bottom: 'تقدمي'
};

const DOT_COLORS = ['#f44336', '#4caf50', '#2196f3', '#ffeb3b', '#e91e63', '#00bcd4', '#ff9800', '#9c27b0'];

const DEFAULT_COLORS: Colors = {
    topLeft: '#4CAF50',
    topRight: '#2196F3',
    bottomLeft: '#FF9800',
    bottomRight: '#9C27B0'
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function safeColor(value: unknown, fallback: string): string {
    return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

/** Names and axis labels are free text; the SVG export is built as a string. */
function escapeXml(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Saved state is untrusted: keep only well-formed fields, defaulting the rest. */
function parseSaved(raw: unknown): { axes: Axes; colors: Colors; dots: Dot[] } | null {
    if (!isRecord(raw)) return null;
    const a = isRecord(raw.axes) ? raw.axes : {};
    const c = isRecord(raw.colors) ? raw.colors : {};
    const text = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback;

    const axes: Axes = {
        left: text(a.left, DEFAULT_AXES.left),
        right: text(a.right, DEFAULT_AXES.right),
        top: text(a.top, DEFAULT_AXES.top),
        bottom: text(a.bottom, DEFAULT_AXES.bottom),
    };
    const colors: Colors = {
        topLeft: safeColor(c.topLeft, DEFAULT_COLORS.topLeft),
        topRight: safeColor(c.topRight, DEFAULT_COLORS.topRight),
        bottomLeft: safeColor(c.bottomLeft, DEFAULT_COLORS.bottomLeft),
        bottomRight: safeColor(c.bottomRight, DEFAULT_COLORS.bottomRight),
    };
    const dots: Dot[] = (Array.isArray(raw.dots) ? raw.dots : [])
        .filter(isRecord)
        .filter((d) => Number.isFinite(d.id) && Number.isFinite(d.x) && Number.isFinite(d.y))
        .map((d, i) => ({
            id: d.id as number,
            x: d.x as number,
            y: d.y as number,
            color: safeColor(d.color, DOT_COLORS[i % DOT_COLORS.length]),
            name: text(d.name, ''),
        }));
    return { axes, colors, dots };
}

export default function CompassClient() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [axes, setAxes] = useState<Axes>(DEFAULT_AXES);
    const [colors, setColors] = useState<Colors>(DEFAULT_COLORS);
    const [dots, setDots] = useState<Dot[]>([]);
    const [selectedDotId, setSelectedDotId] = useState<number | null>(null);
    const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg'>('png');
    const [shareOpen, setShareOpen] = useState(false);
    const [compassSnapshotUrl, setCompassSnapshotUrl] = useState<string | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        try {
            const savedData = localStorage.getItem('politicalCompass');
            const parsed = savedData ? parseSaved(JSON.parse(savedData)) : null;
            if (parsed) {
                setAxes(parsed.axes);
                setColors(parsed.colors);
                setDots(parsed.dots);
            }
        } catch (e) {
            console.error('Failed to load from storage', e);
        }
    }, []);

    // Save to local storage. Storage throws in private mode and when it is
    // disabled entirely; the compass must keep working without persisting.
    useEffect(() => {
        try {
            localStorage.setItem('politicalCompass', JSON.stringify({ axes, colors, dots }));
        } catch {
            // nothing to save to
        }
    }, [axes, colors, dots]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const size = Math.min(container.clientWidth - 32, 600); // 32px padding estimate
        canvas.width = size;
        canvas.height = size;
        drawCompass();
    }, [axes, colors, dots]);

    // Observe the container, not the window: the grid column can change width
    // without a window resize (sidebar, font load, layout shifts).
    useEffect(() => {
        const container = containerRef.current;
        resizeCanvas();
        if (!container || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => resizeCanvas());
        observer.observe(container);
        return () => observer.disconnect();
    }, [resizeCanvas]);

    const drawCompass = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.clearRect(0, 0, width, height);

        const drawQuad = (color: string, x: number, y: number, w: number, h: number) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
        };

        drawQuad(colors.topLeft, 0, 0, centerX, centerY);
        drawQuad(colors.topRight, centerX, 0, centerX, centerY);
        drawQuad(colors.bottomLeft, 0, centerY, centerX, centerY);
        drawQuad(colors.bottomRight, centerX, centerY, centerX, centerY);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "IBM Plex Sans Arabic", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const padding = 20;
        ctx.fillText(axes.left, padding + 20, centerY - padding);
        ctx.fillText(axes.right, width - padding - 20, centerY - padding);

        ctx.save();
        ctx.translate(centerX + padding, padding + 10);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(axes.top, 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(centerX + padding, height - padding - 10);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(axes.bottom, 0, 0);
        ctx.restore();

        dots.forEach(dot => {
            ctx.fillStyle = dot.color;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 8, 0, 2 * Math.PI);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (dot.name) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px "IBM Plex Sans Arabic", sans-serif';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.fillText(dot.name, dot.x, dot.y - 15);
                ctx.shadowBlur = 0;
            }
        });
    }, [axes, colors, dots]);

    useEffect(() => {
        drawCompass();
    }, [drawCompass]);


    const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        // Primary button only, so a right-click or middle-click does not add a point.
        if (e.button !== 0) return;
        const { x, y } = getCanvasCoords(e);

        const clickedDot = dots.findLast(dot => {
            const dist = Math.sqrt((dot.x - x) ** 2 + (dot.y - y) ** 2);
            return dist <= 15;
        });

        if (clickedDot) {
            // Capture keeps the drag alive when the pointer leaves the canvas.
            e.currentTarget.setPointerCapture(e.pointerId);
            setSelectedDotId(clickedDot.id);
            setIsDragging(true);
            setDragOffset({ x: x - clickedDot.x, y: y - clickedDot.y });
        } else {
            addDot(x, y);
        }
    };

    const addDot = (x: number, y: number) => {
        const newDot: Dot = {
            id: Date.now(),
            x,
            y,
            color: DOT_COLORS[dots.length % DOT_COLORS.length],
            name: `نقطة ${dots.length + 1}`
        };
        setDots([...dots, newDot]);
        setSelectedDotId(newDot.id);
    };

    const addDotAtCenter = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        addDot(canvas.width / 2, canvas.height / 2);
    };

    const handleUpdateDotPosition = (id: number, axis: 'x' | 'y', value: number) => {
        if (!Number.isFinite(value)) return;
        const limit = (axis === 'x' ? canvasRef.current?.width : canvasRef.current?.height) ?? 600;
        const clamped = Math.min(Math.max(value, 0), limit);
        setDots(prev => prev.map(d => d.id === id ? { ...d, [axis]: clamped } : d));
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDragging || selectedDotId === null) return;

        const { x, y } = getCanvasCoords(e);
        setDots(prev => prev.map(d => {
            if (d.id === selectedDotId) {
                return { ...d, x: x - dragOffset.x, y: y - dragOffset.y };
            }
            return d;
        }));
    };

    const endDrag = () => {
        setIsDragging(false);
    };

    const handleDeleteDot = async (id: number) => {
        if (await confirmDialog({ title: 'حذف هذه النقطة؟', destructive: true, confirmText: 'حذف' })) {
            setDots(prev => prev.filter(d => d.id !== id));
            if (selectedDotId === id) setSelectedDotId(null);
        }
    };

    const handleUpdateDotName = (id: number, newName: string) => {
        setDots(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
    };

    const downloadSvg = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width, height } = canvas;
        const centerX = width / 2;
        const centerY = height / 2;
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        svg += `<rect x="0" y="0" width="${centerX}" height="${centerY}" fill="${safeColor(colors.topLeft, DEFAULT_COLORS.topLeft)}"/>`;
        svg += `<rect x="${centerX}" y="0" width="${centerX}" height="${centerY}" fill="${safeColor(colors.topRight, DEFAULT_COLORS.topRight)}"/>`;
        svg += `<rect x="0" y="${centerY}" width="${centerX}" height="${centerY}" fill="${safeColor(colors.bottomLeft, DEFAULT_COLORS.bottomLeft)}"/>`;
        svg += `<rect x="${centerX}" y="${centerY}" width="${centerX}" height="${centerY}" fill="${safeColor(colors.bottomRight, DEFAULT_COLORS.bottomRight)}"/>`;

        svg += `<line x1="${centerX}" y1="0" x2="${centerX}" y2="${height}" stroke="#fff" stroke-width="2"/>`;
        svg += `<line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" stroke="#fff" stroke-width="2"/>`;

        const txtStyle = 'fill="#fff" font-family="IBM Plex Sans Arabic, sans-serif" font-weight="bold" font-size="16" text-anchor="middle"';
        svg += `<text x="${centerX - 100}" y="${centerY - 10}" ${txtStyle}>${escapeXml(axes.left)}</text>`;
        svg += `<text x="${centerX + 100}" y="${centerY - 10}" ${txtStyle}>${escapeXml(axes.right)}</text>`;
        svg += `<text x="${centerX + 15}" y="${centerY - 100}" ${txtStyle} transform="rotate(90, ${centerX + 15}, ${centerY - 100})">${escapeXml(axes.top)}</text>`;
        svg += `<text x="${centerX + 15}" y="${centerY + 100}" ${txtStyle} transform="rotate(90, ${centerX + 15}, ${centerY + 100})">${escapeXml(axes.bottom)}</text>`;

        dots.forEach(dot => {
            svg += `<circle cx="${dot.x}" cy="${dot.y}" r="8" fill="${safeColor(dot.color, DOT_COLORS[0])}" stroke="#fff" stroke-width="2"/>`;
            if (dot.name) {
                svg += `<text x="${dot.x}" y="${dot.y - 20}" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle" style="text-shadow: 0px 1px 2px rgba(0,0,0,0.5);">${escapeXml(dot.name)}</text>`;
            }
        });
        svg += '</svg>';

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'political-compass.svg';
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const exportCompass = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (exportFormat === 'svg') {
            downloadSvg();
        } else {
            setCompassSnapshotUrl(canvas.toDataURL('image/png'));
            setShareOpen(true);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background font-sans" dir="rtl">
            <section className="bg-card border-b border-border py-10 shadow-sm">
                <div className="container mx-auto px-4 text-center max-w-3xl">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">مولد البوصلة السياسية المخصص</h1>
                    <p className="text-xl text-muted-foreground">أنشئ بوصلتك السياسية الخاصة مع إمكانية تخصيص الألوان والمحاور والنقاط</p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-8 flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <ArrowsUpFromLine className="me-2 w-5 h-5 text-primary" />
                                    محاور البوصلة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>المحور الأفقي (اليسار)</Label>
                                    <Input aria-label="المحور الأفقي (اليسار)" value={axes.left} onChange={(e) => setAxes({ ...axes, left: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>المحور الأفقي (اليمين)</Label>
                                    <Input aria-label="المحور الأفقي (اليمين)" value={axes.right} onChange={(e) => setAxes({ ...axes, right: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>المحور العمودي (الأعلى)</Label>
                                    <Input aria-label="المحور العمودي (الأعلى)" value={axes.top} onChange={(e) => setAxes({ ...axes, top: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>المحور العمودي (الأسفل)</Label>
                                    <Input aria-label="المحور العمودي (الأسفل)" value={axes.bottom} onChange={(e) => setAxes({ ...axes, bottom: e.target.value })} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <Palette className="me-2 w-5 h-5 text-primary" />
                                    ألوان الأقسام
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">أعلى اليسار</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" aria-label="أعلى اليسار" value={colors.topLeft} onChange={(e) => setColors({ ...colors, topLeft: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">أعلى اليمين</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" aria-label="أعلى اليمين" value={colors.topRight} onChange={(e) => setColors({ ...colors, topRight: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">أسفل اليسار</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" aria-label="أسفل اليسار" value={colors.bottomLeft} onChange={(e) => setColors({ ...colors, bottomLeft: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">أسفل اليمين</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" aria-label="أسفل اليمين" value={colors.bottomRight} onChange={(e) => setColors({ ...colors, bottomRight: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <MapPin className="me-2 w-5 h-5 text-primary" />
                                    النقاط ({dots.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[200px] ps-4">
                                    {dots.length === 0 ? (
                                        <p className="text-center text-sm text-muted-foreground py-4">لا توجد نقاط مضافة. انقر على البوصلة لإضافة نقطة.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {dots.map((dot, index) => (
                                                <div key={dot.id} className="p-2 bg-muted rounded border border-border space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div aria-hidden="true" className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: dot.color }} />
                                                        <Input
                                                            aria-label={`اسم النقطة ${index + 1}`}
                                                            value={dot.name}
                                                            onChange={(e) => handleUpdateDotName(dot.id, e.target.value)}
                                                            className="h-8 text-sm text-foreground bg-card"
                                                        />
                                                        <Button variant="ghost" size="icon" aria-label={`حذف ${dot.name || `النقطة ${index + 1}`}`} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDot(dot.id)}>
                                                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                    {/* The canvas is pointer-only; these place the point from the keyboard. */}
                                                    <div className="grid grid-cols-2 gap-2 ps-6">
                                                        <Input
                                                            type="number"
                                                            inputMode="numeric"
                                                            aria-label={`الموضع الأفقي لـ ${dot.name || `النقطة ${index + 1}`}`}
                                                            title="الموضع الأفقي (بكسل)"
                                                            min={0}
                                                            step={5}
                                                            value={Math.round(dot.x)}
                                                            onChange={(e) => handleUpdateDotPosition(dot.id, 'x', e.target.valueAsNumber)}
                                                            className="h-7 text-xs text-foreground bg-card"
                                                        />
                                                        <Input
                                                            type="number"
                                                            inputMode="numeric"
                                                            aria-label={`الموضع العمودي لـ ${dot.name || `النقطة ${index + 1}`}`}
                                                            title="الموضع العمودي (بكسل)"
                                                            min={0}
                                                            step={5}
                                                            value={Math.round(dot.y)}
                                                            onChange={(e) => handleUpdateDotPosition(dot.id, 'y', e.target.valueAsNumber)}
                                                            className="h-7 text-xs text-foreground bg-card"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                                <Button type="button" variant="outline" size="sm" className="w-full mt-3" onClick={addDotAtCenter}>
                                    <Plus className="me-2 w-4 h-4" aria-hidden="true" />
                                    إضافة نقطة في المنتصف
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <Download className="me-2 w-5 h-5 text-primary" />
                                    تصدير البوصلة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div role="group" aria-label="صيغة التصدير" className="flex p-1 bg-muted rounded-lg">
                                    {(['png', 'jpg', 'svg'] as const).map(fmt => (
                                        <button
                                            key={fmt}
                                            type="button"
                                            aria-pressed={exportFormat === fmt}
                                            onClick={() => setExportFormat(fmt)}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${exportFormat === fmt ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={exportCompass}>
                                    {exportFormat === 'svg' ? (
                                        <Download className="w-4 h-4" aria-hidden="true" />
                                    ) : (
                                        <Share2 className="w-4 h-4" aria-hidden="true" />
                                    )}
                                    {exportFormat === 'svg' ? 'تحميل SVG' : 'معاينة ومشاركة الصورة'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 order-1 lg:order-2">
                        <div ref={containerRef} className="bg-card rounded-xl shadow border border-border p-4 flex flex-col items-center justify-center min-h-[400px]">
                            <canvas
                                ref={canvasRef}
                                role="img"
                                aria-label={`بوصلة سياسية: المحور الأفقي من ${axes.left} إلى ${axes.right}، والعمودي من ${axes.top} إلى ${axes.bottom}، وعليها ${dots.length} ${dots.length === 1 ? 'نقطة' : 'نقاط'}. أدر النقاط من قائمة النقاط.`}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={endDrag}
                                onPointerCancel={endDrag}
                                onLostPointerCapture={endDrag}
                                className="max-w-full touch-none cursor-crosshair border-4 border-border rounded-sm shadow-sm"
                                style={{ touchAction: 'none' }}
                            />
                            <div className="mt-4 text-center text-sm text-muted-foreground flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                <span>اضغط على البوصلة لإضافة نقاط جديدة، أو اسحب النقاط الموجودة لتغيير مكانها</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="bg-card border-t border-border py-8 mt-auto">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-muted-foreground">&copy; 2025 syrian.zone</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        تم التطوير بواسطة <span className="font-semibold text-foreground">هادي الأحمد</span>
                    </p>
                    <div className="flex justify-center gap-6 mt-4">
                        <a href="https://hadealahmad.com" target="_blank" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-sm">
                            <Globe className="w-4 h-4" /> الموقع الشخصي
                        </a>
                        <a href="https://x.com/hadealahmad" target="_blank" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-sm">
                            <Twitter className="w-4 h-4" /> Twitter (X)
                        </a>
                    </div>
                </div>
            </footer>
            <ShareImageDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                title="مشاركة البوصلة السياسية"
                description="معاينة البوصلة بإطار المساحة السورية قبل المشاركة أو التحميل."
                filename="political-compass.png"
                shareTitle="البوصلة السياسية المخصصة"
                previewMaxWidth={460}
                extraActions={
                    <Button type="button" variant="outline" onClick={downloadSvg} className="gap-2">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        تحميل SVG
                    </Button>
                }
                renderCard={({ themeId, cardRef }) => (
                    <BrandShareFrame
                        ref={cardRef}
                        id="alignment-share-card"
                        themeId={themeId}
                        moduleLabel="البوصلة المخصصة"
                        shareUrl="syrian.zone/alignment"
                        format="auto"
                        width={460}
                    >
                        {(tokens) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                                    <div
                                        style={{
                                            fontFamily: MADAR_DISPLAY_FONT,
                                            fontSize: 20,
                                            fontWeight: 800,
                                            color: tokens.ink,
                                        }}
                                    >
                                        البوصلة السياسية
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: tokens.muted }}>
                                        {axes.top} / {axes.bottom}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        border: `1px solid ${tokens.border}`,
                                        backgroundColor: tokens.card,
                                        padding: 8,
                                    }}
                                >
                                    {compassSnapshotUrl && (
                                        <img
                                            src={compassSnapshotUrl}
                                            alt="معاينة البوصلة السياسية"
                                            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </BrandShareFrame>
                )}
            />
        </div>
    );
}
