"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowsUpFromLine, Palette, MapPin, Download, Info, Globe, Trash2, Edit2, Plus } from 'lucide-react';
import { Twitter } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const DEFAULT_COLORS: Colors = {
    topLeft: '#4CAF50',
    topRight: '#2196F3',
    bottomLeft: '#FF9800',
    bottomRight: '#9C27B0'
};

export default function CompassClient() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // State
    const [axes, setAxes] = useState<Axes>(DEFAULT_AXES);
    const [colors, setColors] = useState<Colors>(DEFAULT_COLORS);
    const [dots, setDots] = useState<Dot[]>([]);
    const [selectedDotId, setSelectedDotId] = useState<number | null>(null);
    const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg'>('png');

    // Internal state for dragging
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Load from local storage
    useEffect(() => {
        try {
            const savedData = localStorage.getItem('politicalCompass');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed.axes) setAxes(parsed.axes);
                if (parsed.colors) setColors(parsed.colors);
                if (parsed.dots) setDots(parsed.dots);
            }
        } catch (e) {
            console.error('Failed to load from storage', e);
        }
    }, []);

    // Save to local storage
    useEffect(() => {
        localStorage.setItem('politicalCompass', JSON.stringify({ axes, colors, dots }));
    }, [axes, colors, dots]);

    // Resize Canvas
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const size = Math.min(container.clientWidth - 32, 600); // 32px padding estimate
        canvas.width = size;
        canvas.height = size;
        drawCompass();
    }, [axes, colors, dots]); // Redraw when these change

    // Listen to resize
    useEffect(() => {
        window.addEventListener('resize', resizeCanvas);
        // Initial resize
        resizeCanvas();
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [resizeCanvas]);

    // Draw Function
    const drawCompass = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.clearRect(0, 0, width, height);

        // Draw Quadrants
        const drawQuad = (color: string, x: number, y: number, w: number, h: number) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
        };

        drawQuad(colors.topLeft, 0, 0, centerX, centerY);
        drawQuad(colors.topRight, centerX, 0, centerX, centerY);
        drawQuad(colors.bottomLeft, 0, centerY, centerX, centerY);
        drawQuad(colors.bottomRight, centerX, centerY, centerX, centerY);

        // Grid Lines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "IBM Plex Sans Arabic", sans-serif'; // Reduced font size slightly
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Axis Labels
        const padding = 20;
        ctx.fillText(axes.left, padding + 20, centerY - padding);
        ctx.fillText(axes.right, width - padding - 20, centerY - padding);

        // Rotate for top/bottom
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

        // Dots
        dots.forEach(dot => {
            ctx.fillStyle = dot.color;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 8, 0, 2 * Math.PI); // Slightly smaller dots
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
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

    // Redraw whenever state changes
    useEffect(() => {
        drawCompass();
    }, [drawCompass]);


    // Canvas Event Handlers
    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0) {
            clientX = (e as React.TouchEvent).changedTouches[0].clientX;
            clientY = (e as React.TouchEvent).changedTouches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        // e.preventDefault(); // Prevent scrolling on touch? Maybe.
        const { x, y } = getCanvasCoords(e);

        // Check for existing dot
        const clickedDot = dots.slice().reverse().find(dot => {
            const dist = Math.sqrt((dot.x - x) ** 2 + (dot.y - y) ** 2);
            return dist <= 15; // Hit radius
        });

        if (clickedDot) {
            setSelectedDotId(clickedDot.id);
            setIsDragging(true);
            setDragOffset({ x: x - clickedDot.x, y: y - clickedDot.y });
        } else {
            // Add new dot
            const colors = ['#f44336', '#4caf50', '#2196f3', '#ffeb3b', '#e91e63', '#00bcd4', '#ff9800', '#9c27b0'];
            const newDot: Dot = {
                id: Date.now(),
                x,
                y,
                color: colors[dots.length % colors.length],
                name: `نقطة ${dots.length + 1}`
            };
            setDots([...dots, newDot]);
            setSelectedDotId(newDot.id);
            // Optional: immediately prompt for name editor?
        }
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || selectedDotId === null) return;
        // e.preventDefault();

        const { x, y } = getCanvasCoords(e);
        setDots(prev => prev.map(d => {
            if (d.id === selectedDotId) {
                return { ...d, x: x - dragOffset.x, y: y - dragOffset.y };
            }
            return d;
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleDeleteDot = (id: number) => {
        if (confirm('هل أنت متأكد من حذف هذه النقطة؟')) {
            setDots(prev => prev.filter(d => d.id !== id));
            if (selectedDotId === id) setSelectedDotId(null);
        }
    };

    const handleUpdateDotName = (id: number, newName: string) => {
        setDots(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
    };

    const exportCompass = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (exportFormat === 'svg') {
            const { width, height } = canvas;
            const centerX = width / 2;
            const centerY = height / 2;
            let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

            // Backgrounds
            svg += `<rect x="0" y="0" width="${centerX}" height="${centerY}" fill="${colors.topLeft}"/>`;
            svg += `<rect x="${centerX}" y="0" width="${centerX}" height="${centerY}" fill="${colors.topRight}"/>`;
            svg += `<rect x="0" y="${centerY}" width="${centerX}" height="${centerY}" fill="${colors.bottomLeft}"/>`;
            svg += `<rect x="${centerX}" y="${centerY}" width="${centerX}" height="${centerY}" fill="${colors.bottomRight}"/>`;

            // Axes
            svg += `<line x1="${centerX}" y1="0" x2="${centerX}" y2="${height}" stroke="#fff" stroke-width="2"/>`;
            svg += `<line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" stroke="#fff" stroke-width="2"/>`;

            // Labels with Arabic font assumption
            const txtStyle = 'fill="#fff" font-family="IBM Plex Sans Arabic, sans-serif" font-weight="bold" font-size="16" text-anchor="middle"';
            svg += `<text x="${centerX - 100}" y="${centerY - 10}" ${txtStyle}>${axes.left}</text>`;
            svg += `<text x="${centerX + 100}" y="${centerY - 10}" ${txtStyle}>${axes.right}</text>`;
            svg += `<text x="${centerX + 15}" y="${centerY - 100}" ${txtStyle} transform="rotate(90, ${centerX + 15}, ${centerY - 100})">${axes.top}</text>`;
            svg += `<text x="${centerX + 15}" y="${centerY + 100}" ${txtStyle} transform="rotate(90, ${centerX + 15}, ${centerY + 100})">${axes.bottom}</text>`;

            // Dots
            dots.forEach(dot => {
                svg += `<circle cx="${dot.x}" cy="${dot.y}" r="8" fill="${dot.color}" stroke="#fff" stroke-width="2"/>`;
                if (dot.name) {
                    svg += `<text x="${dot.x}" y="${dot.y - 20}" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle" style="text-shadow: 0px 1px 2px rgba(0,0,0,0.5);">${dot.name}</text>`;
                }
            });
            svg += '</svg>';

            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'political-compass.svg';
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } else {
            const link = document.createElement('a');
            link.download = `political-compass.${exportFormat}`;
            link.href = canvas.toDataURL(`image/${exportFormat}`, exportFormat === 'jpg' ? 0.9 : undefined);
            link.click();
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background font-sans" dir="rtl">
            {/* Hero Section */}
            <section className="bg-card border-b border-border py-10 shadow-sm">
                <div className="container mx-auto px-4 text-center max-w-3xl">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">مولد البوصلة السياسية المخصص</h1>
                    <p className="text-xl text-muted-foreground">أنشئ بوصلتك السياسية الخاصة مع إمكانية تخصيص الألوان والمحاور والنقاط</p>
                </div>
            </section>

            <main className="container mx-auto px-4 py-8 flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Controls Sidebar - Desktop: Left col, Mobile: Top */}
                    <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <ArrowsUpFromLine className="ml-2 w-5 h-5 text-primary" />
                                    محاور البوصلة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>المحور الأفقي (اليسار)</Label>
                                    <Input value={axes.left} onChange={(e) => setAxes({ ...axes, left: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>المحور الأفقي (اليمين)</Label>
                                    <Input value={axes.right} onChange={(e) => setAxes({ ...axes, right: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>المحور العمودي (الأعلى)</Label>
                                    <Input value={axes.top} onChange={(e) => setAxes({ ...axes, top: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>المحور العمودي (الأسفل)</Label>
                                    <Input value={axes.bottom} onChange={(e) => setAxes({ ...axes, bottom: e.target.value })} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <Palette className="ml-2 w-5 h-5 text-primary" />
                                    ألوان الأقسام
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">أعلى اليسار</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={colors.topLeft} onChange={(e) => setColors({ ...colors, topLeft: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">أعلى اليمين</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={colors.topRight} onChange={(e) => setColors({ ...colors, topRight: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">أسفل اليسار</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={colors.bottomLeft} onChange={(e) => setColors({ ...colors, bottomLeft: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">أسفل اليمين</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={colors.bottomRight} onChange={(e) => setColors({ ...colors, bottomRight: e.target.value })} className="w-12 h-8 p-0 border-0" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <MapPin className="ml-2 w-5 h-5 text-primary" />
                                    النقاط ({dots.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[200px] pr-4">
                                    {dots.length === 0 ? (
                                        <p className="text-center text-sm text-muted-foreground py-4">لا توجد نقاط مضافة. انقر على البوصلة لإضافة نقطة.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {dots.map((dot, index) => (
                                                <div key={dot.id} className="flex items-center gap-2 p-2 bg-muted rounded border border-border">
                                                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: dot.color }} />
                                                    <Input
                                                        value={dot.name}
                                                        onChange={(e) => handleUpdateDotName(dot.id, e.target.value)}
                                                        className="h-8 text-sm text-foreground bg-card"
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDot(dot.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg">
                                    <Download className="ml-2 w-5 h-5 text-primary" />
                                    تصدير البوصلة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex p-1 bg-muted rounded-lg">
                                    {(['png', 'jpg', 'svg'] as const).map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => setExportFormat(fmt)}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${exportFormat === fmt ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={exportCompass}>
                                    <Download className="ml-2 w-4 h-4" />
                                    تصدير
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Canvas Area */}
                    <div className="lg:col-span-8 order-1 lg:order-2">
                        <div ref={containerRef} className="bg-card rounded-xl shadow border border-border p-4 flex flex-col items-center justify-center min-h-[400px]">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleMouseDown}
                                onTouchMove={handleMouseMove}
                                onTouchEnd={handleMouseUp}
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
            </main>

            {/* Footer */}
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
        </div>
    );
}
