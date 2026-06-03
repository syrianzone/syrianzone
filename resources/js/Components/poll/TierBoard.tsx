"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierAvatar as Avatar } from "@/components/poll/TierAvatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2Icon, AlertCircleIcon, Download } from "lucide-react";
import { exportTierListFromData } from "@/lib/exportImage";
import axios from "@/lib/axios";
import JSZip from "jszip";
import "./poll.css";

type Candidate = {
    id: string;
    candidate_group_id?: string | null;
    name: string;
    title?: string | null;
    imageUrl: string | null;
    category?: string | null; // Keep for legacy fallback if needed
};

type CandidateGroup = {
    id: string;
    name: string;
    key?: string | null;
};

type Props = {
    initialCandidates: Candidate[];
    groups: CandidateGroup[];
    pollId: string;
    voteDay: string;
    submitApiPath?: string; // e.g., "/api/jolani/submit"
    minSelections?: number; // default 3; use 1 for Jolani
    pollSlug?: string; // optional; used only in payload for compatibility
};

type TierKey = "S" | "A" | "B" | "C" | "D" | "F";

const tierKeys: TierKey[] = ["S", "A", "B", "C", "D", "F"];

const tierStyles: Record<
    TierKey,
    { label: string; area: string; border: string }
> = {
    S: { label: "bg-rose-600", area: "bg-rose-50", border: "border-rose-200" },
    A: { label: "bg-amber-600", area: "bg-amber-50", border: "border-amber-200" },
    B: {
        label: "bg-emerald-600",
        area: "bg-emerald-50",
        border: "border-emerald-200",
    },
    C: { label: "bg-sky-600", area: "bg-sky-50", border: "border-sky-200" },
    D: {
        label: "bg-violet-600",
        area: "bg-violet-50",
        border: "border-violet-200",
    },
    F: { label: "bg-gray-800", area: "bg-gray-100", border: "border-gray-300" },
};

const tierDescriptions: Record<TierKey, string> = {
    S: "ممتاز",
    A: "جيد جدًا",
    B: "جيد",
    C: "مقبول",
    D: "ضعيف",
    F: "سيئ",
};

const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? "";

export default function TierBoard({
    initialCandidates,
    groups,
    pollId,
    voteDay,
    submitApiPath,
    minSelections = 3,
    pollSlug,
}: Props) {
    const [tiers, setTiers] = useState<Record<TierKey, Candidate[]>>({
        S: [],
        A: [],
        B: [],
        C: [],
        D: [],
        F: [],
    });
    // Single-select tier modal disabled — multi-select only
    // const [selectedForTier, setSelectedForTier] = useState<string | null>(null);
    // const [modalPosition, setModalPosition] = useState<{
    //     top: number;
    //     left: number;
    // } | null>(null);
    // Deterministic seeded shuffle to avoid SSR/CSR hydration mismatch
    const shuffledInitial = useMemo(() => {
        function xmur3(str: string): number {
            let h = 1779033703 ^ str.length;
            for (let i = 0; i < str.length; i++) {
                h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
                h = (h << 13) | (h >>> 19);
            }
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return (h ^= h >>> 16) >>> 0;
        }
        function mulberry32(a: number) {
            return function () {
                a |= 0;
                a = (a + 0x6d2b79f5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        const seedStr = `${pollId}|${voteDay}`;
        const rng = mulberry32(xmur3(seedStr));
        const copy = [...initialCandidates];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }, [initialCandidates, pollId, voteDay]);

    // Initial selected category: default group or first group or "all"
    const [selectedGroupId, setSelectedGroupId] = useState<string>(
        groups.find(g => (g as any).is_default)?.id || groups[0]?.id || "all"
    );

    const [bank, setBank] = useState<Candidate[]>([]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const tiersRef = useRef<HTMLDivElement>(null);
    const [submitStatus, setSubmitStatus] = useState<{
        ok: boolean;
        message: string;
        description?: string;
    } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [nextSubmitAt, setNextSubmitAt] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());

    const cooldownKey = `submitCooldown:${pollId}:${voteDay}`;

    function createEmptyTiers(): Record<TierKey, Candidate[]> {
        return { S: [], A: [], B: [], C: [], D: [], F: [] };
    }


    // WebSocket for real-time updates - removed as it's not implemented in this stack

    useEffect(() => {
        const stored = localStorage.getItem(cooldownKey);
        if (stored) {
            const ts = parseInt(stored, 10);
            if (!Number.isNaN(ts) && ts > Date.now()) {
                setNextSubmitAt(ts);
            } else if (!Number.isNaN(ts)) {
                localStorage.removeItem(cooldownKey);
            }
        }
    }, []);

    useEffect(() => {
        if (!nextSubmitAt) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [nextSubmitAt]);

    useEffect(() => {
        if (nextSubmitAt && now >= nextSubmitAt) {
            setNextSubmitAt(null);
            localStorage.removeItem(cooldownKey);
        }
    }, [now, nextSubmitAt, cooldownKey]);

    useEffect(() => {
        if (!submitStatus) return;
        const id = setTimeout(() => setSubmitStatus(null), 5000);
        return () => clearTimeout(id);
    }, [submitStatus]);

    // Switch between categories for the bank. Reset tiers to avoid cross-poll submission.
    // Important: do NOT depend on 'tiers' here to avoid infinite update loops.
    useEffect(() => {
        setSelectedIds(new Set());
        setTiers(createEmptyTiers());

        const filtered = shuffledInitial.filter((c) => {
            if (groups.length > 0) {
                // Match by group ID if present (Strict filtering)
                if (c.candidate_group_id) {
                    return c.candidate_group_id === selectedGroupId;
                }

                // Fallback legacy match ONLY if no group ID is assigned
                const group = groups.find(g => g.id === selectedGroupId);
                if (group && group.key === c.category) return true;

                return false;
            }
            return true; // No groups defined? Show all? Or nothing.
        });
        setBank(filtered);
    }, [selectedGroupId, shuffledInitial, groups]);

    function moveCandidateTo(candidateId: string, target: TierKey | "bank") {
        const fromTierKey = tierKeys.find((k) =>
            tiers[k].some((c) => c.id === candidateId)
        );
        const fromBank = bank.some((c) => c.id === candidateId);
        let candidate: Candidate | undefined;
        if (fromTierKey)
            candidate = tiers[fromTierKey].find((c) => c.id === candidateId);
        if (!candidate && fromBank)
            candidate = bank.find((c) => c.id === candidateId);
        if (!candidate) return;

        setTiers((t) => {
            const copy: Record<TierKey, Candidate[]> = { ...t };
            for (const k of tierKeys)
                copy[k] = copy[k].filter((c) => c.id !== candidateId);
            return copy;
        });
        setBank((b) => b.filter((c) => c.id !== candidateId));

        if (target === "bank") {
            setBank((b) => [...b, candidate!]);
        } else {
            setTiers((t) => ({ ...t, [target]: [...t[target], candidate!] }));
        }
    }

    function moveCandidatesTo(candidateIds: string[], target: TierKey | "bank") {
        const idSet = new Set(candidateIds);
        const found: Candidate[] = [
            ...tierKeys.flatMap((k) => tiers[k].filter((c) => idSet.has(c.id))),
            ...bank.filter((c) => idSet.has(c.id)),
        ];
        setTiers((prev) => {
            const copy: Record<TierKey, Candidate[]> = { ...prev } as Record<
                TierKey,
                Candidate[]
            >;
            for (const k of tierKeys)
                copy[k] = copy[k].filter((c) => !idSet.has(c.id));
            if (target !== "bank") copy[target] = [...copy[target], ...found];
            return copy;
        });
        setBank((prev) => {
            const filtered = prev.filter((c) => !idSet.has(c.id));
            return target === "bank" ? [...filtered, ...found] : filtered;
        });
        setSelectedIds(new Set());
    }

    function toggleSelected(id: string) {
        setSelectedIds((prev) => {
            // const isInBank = bank.some((c) => c.id === id);
            // if (!isInBank) return prev;
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleDragStart(e: React.DragEvent, id: string) {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        // Ghost image usually works better if we don't interfere too much
        // but we can set a class to indicate dragging if needed
    }

    function handleDrop(e: React.DragEvent, target: TierKey | "bank") {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) moveCandidateTo(id, target);
    }

    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }

    // Single-select tier modal click handler disabled — clicks now toggle multi-select
    // function handleCandidateClick(e: React.MouseEvent, candidateId: string) {
    //     e.stopPropagation();
    //     if (e.shiftKey || e.ctrlKey || e.metaKey) {
    //         toggleSelected(candidateId);
    //         setSelectedForTier(null);
    //         setModalPosition(null);
    //         return;
    //     }
    //     if (selectedForTier === candidateId) {
    //         setSelectedForTier(null);
    //         setModalPosition(null);
    //     } else {
    //         const rect = e.currentTarget.getBoundingClientRect();
    //         setModalPosition({
    //             top: rect.top - 10,
    //             left: rect.left + rect.width / 2,
    //         });
    //         setSelectedForTier(candidateId);
    //         setSelectedIds(new Set());
    //     }
    // }
    async function submit() {
        const totalAssigned = tierKeys.reduce((acc, k) => acc + tiers[k].length, 0);
        if (totalAssigned < (minSelections || 3)) {
            const min = minSelections || 3;
            const minMsg =
                min === 1
                    ? "الحد الأدنى للاختيار هو ١. الرجاء اختيار عنصر واحد على الأقل."
                    : `الحد الأدنى للاختيار هو ${min}. الرجاء اختيار ${min} على الأقل.`;
            setSubmitStatus({ ok: false, message: minMsg });
            return;
        }
        if (nextSubmitAt && Date.now() < nextSubmitAt) {
            const seconds = Math.ceil((nextSubmitAt - Date.now()) / 1000);
            const minutes = Math.floor(seconds / 60);
            const rem = seconds % 60;
            setSubmitStatus({
                ok: false,
                message: `الرجاء الانتظار ${minutes}:${rem
                    .toString()
                    .padStart(2, "0")} قبل إرسال تصويت آخر`,
            });
            return;
        }
        setIsSubmitting(true);
        const deviceId = localStorage.getItem("deviceId") || crypto.randomUUID();
        localStorage.setItem("deviceId", deviceId);
        const payload: {
            pollSlug?: string;
            deviceId: string;
            tiers: Record<TierKey, Array<{ candidateId: string; pos: number }>>;
        } = {
            pollSlug: pollSlug || "best-ministers",
            deviceId,
            tiers: tierKeys.reduce(
                (acc, k) => {
                    acc[k] = tiers[k].map((c, idx) => ({ candidateId: c.id, pos: idx }));
                    return acc;
                },
                {
                    S: [] as Array<{ candidateId: string; pos: number }>,
                    A: [] as Array<{ candidateId: string; pos: number }>,
                    B: [] as Array<{ candidateId: string; pos: number }>,
                    C: [] as Array<{ candidateId: string; pos: number }>,
                    D: [] as Array<{ candidateId: string; pos: number }>,
                    F: [] as Array<{ candidateId: string; pos: number }>,
                } as Record<TierKey, Array<{ candidateId: string; pos: number }>>
            ),
        };
        // Build submit path without double-prefixing BASE_PATH
        const providedPath = submitApiPath || "/submit";
        // axios baseURL already includes /api usually, or at least the host. 
        // If providedPath is relative, axios uses baseURL.

        try {
            await axios.post(providedPath, payload);
            setSubmitStatus({ ok: true, message: "تم تسجيل التصويت" });
            const ts = Date.now() + 1 * 60 * 1000;
            setNextSubmitAt(ts);
            localStorage.setItem(cooldownKey, String(ts));
            setIsSubmitting(false);
        } catch (error: any) {
            let errorMsg = "حدث خطأ أو تم التصويت اليوم";
            if (error.response && error.response.data) {
                const errData = error.response.data;
                if (errData.error) errorMsg = errData.error;
                else if (errData.message) errorMsg = errData.message;
            }
            setSubmitStatus({ ok: false, message: errorMsg });
            setIsSubmitting(false);
        }
    }

    async function saveImage() {
        setIsSaving(true);
        const appEl = containerRef.current;
        const maxWidthStyle = appEl ? window.getComputedStyle(appEl).maxWidth : "";
        const targetWidthCss =
            maxWidthStyle && maxWidthStyle !== "none" ? maxWidthStyle : "1000px";
        const targetWidth = parseInt(targetWidthCss, 10) || 1000;
        const data = {
            S: tiers.S.map((c) => ({
                name: c.name,
                title: c.title || null,
                imageUrl: c.imageUrl || null,
            })),
            A: tiers.A.map((c) => ({
                name: c.name,
                title: c.title || null,
                imageUrl: c.imageUrl || null,
            })),
            B: tiers.B.map((c) => ({
                name: c.name,
                title: c.title || null,
                imageUrl: c.imageUrl || null,
            })),
            C: tiers.C.map((c) => ({
                name: c.name,
                title: c.title || null,
                imageUrl: c.imageUrl || null,
            })),
            D: tiers.D.map((c) => ({
                name: c.name,
                title: c.title || null,
                imageUrl: c.imageUrl || null,
            })),
            F: tiers.F.map((c) => ({
                name: c.name,
                title: c.title || null,
                imageUrl: c.imageUrl || null,
            })),
        } as Record<
            "S" | "A" | "B" | "C" | "D" | "F",
            Array<{ name: string; title?: string | null; imageUrl?: string | null }>
        >;
        try {
            await exportTierListFromData({
                tiers: data,
                basePath: BASE_PATH,
                fileName: "tier-list.png",
                width: targetWidth,
                scale: 2,
                watermarkText: "syrian.zone/tierlist",
            });
        } finally {
            setIsSaving(false);
        }
    }

    const isJolaniGroup = groups.find(g => g.id === selectedGroupId)?.key === 'jolani';

    function safeFilename(name: string): string {
        return (name || 'image').replace(/[\/\\:*?"<>|]+/g, '_').trim();
    }

    function extFromMime(mime: string | undefined): string {
        switch ((mime || '').toLowerCase()) {
            case 'image/jpeg':
            case 'image/jpg':
                return 'jpg';
            case 'image/png':
                return 'png';
            case 'image/webp':
                return 'webp';
            case 'image/gif':
                return 'gif';
            case 'image/svg+xml':
                return 'svg';
            default:
                return '';
        }
    }

    function extFromUrlPath(url: string): string {
        try {
            const u = new URL(url, window.location.origin);
            const last = u.pathname.split('/').pop() || '';
            const m = last.match(/\.(jpe?g|png|webp|gif|svg)$/i);
            return m ? m[1].toLowerCase() : '';
        } catch {
            return '';
        }
    }

    function pickExtension(url: string, blob: Blob): string {
        return extFromUrlPath(url) || extFromMime(blob.type) || 'png';
    }

    async function downloadImage(url: string, name: string) {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const ext = pickExtension(url, blob);
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${safeFilename(name)}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download failed:', err);
        }
    }

    const [isDownloadingAll, setIsDownloadingAll] = useState(false);

    async function downloadAllImages(candidates: Candidate[]) {
        setIsDownloadingAll(true);
        try {
            const zip = new JSZip();
            for (const c of candidates) {
                if (!c.imageUrl) continue;
                const res = await fetch(c.imageUrl);
                const blob = await res.blob();
                const ext = pickExtension(c.imageUrl, blob);
                zip.file(`${safeFilename(c.name)}.${ext}`, blob);
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'jolani-images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download all failed:', err);
        } finally {
            setIsDownloadingAll(false);
        }
    }

    return (
        <Card
            ref={containerRef}
            className="max-w-screen-lg mx-auto p-4"
            data-capture-root
        >
            <div
                className="mb-4 p-2 bg-muted border border-border rounded min-h-[100px]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "bank")}
                data-bank-area
            >
                <div className="flex flex-col items-center gap-2">
                    <div
                        className="text-sm flex items-center gap-2 overflow-x-auto -mx-2 px-2 max-w-full whitespace-nowrap flex-nowrap"
                        role="tablist"
                        aria-label="التصنيف"
                    >
                        {groups.map((group) => (
                            <button
                                key={group.id}
                                type="button"
                                role="tab"
                                aria-selected={selectedGroupId === group.id}
                                className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm rounded-full border border-border transition-colors shrink-0 ${selectedGroupId === group.id
                                    ? "bg-foreground text-background"
                                    : "bg-card text-foreground hover:bg-muted"
                                    }`}
                                onClick={() => setSelectedGroupId(group.id)}
                            >
                                {group.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-2 p-2">
                    {bank.map((c) => {
                        const selected = selectedIds.has(c.id);
                        return (
                            <div
                                key={c.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, c.id)}
                                onClick={() => toggleSelected(c.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        toggleSelected(c.id);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                className={`group relative flex flex-col items-center gap-1 outline h-auto p-2 pt-3 cursor-pointer select-none rounded-md transition-all active:scale-95 ${selected
                                        ? "bg-purple-600 hover:bg-purple-600 text-white outline-2 outline-purple-400 font-semibold"
                                        : "bg-card text-foreground border border-border hover:bg-muted"
                                    } w-[104px] sm:w-[120px]`}
                                data-selected={selected ? "1" : undefined}
                            >
                                {isJolaniGroup && c.imageUrl && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); downloadImage(c.imageUrl!, c.name); }}
                                        className="absolute top-1 left-1 z-10 p-0.5 rounded bg-black/50 text-white hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                        title="تحميل الصورة"
                                    >
                                        <Download size={14} />
                                    </button>
                                )}
                                <Avatar
                                    src={c.imageUrl || ""}
                                    alt={c.name}
                                    size={48}
                                    className="mb-1 pointer-events-none"
                                />
                                <span className="text-xs text-center leading-tight pointer-events-none">
                                    {c.name}
                                </span>
                                {c.title ? (
                                    <span
                                        className={`text-[11px] text-muted-foreground text-center leading-tight pointer-events-none ${selected ? "text-white" : ""
                                            }`}
                                    >
                                        {c.title}
                                    </span>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Single-select tier modal disabled — multi-select only */}
            {/* {selectedForTier && modalPosition && (
                <div className="fixed inset-0 z-50" onClick={() => { setSelectedForTier(null); setModalPosition(null); }}>
                    <div className="absolute bg-card rounded-lg shadow-2xl border-2 border-border p-1.5"
                        style={{ top: `${modalPosition.top}px`, left: `${modalPosition.left}px`, transform: "translate(-50%, -100%)", minWidth: "160px", maxWidth: "180px" }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-0.5 justify-center">
                            {tierKeys.map((k) => (
                                <button key={k} onClick={() => { moveCandidateTo(selectedForTier, k); setSelectedForTier(null); setModalPosition(null); }}
                                    className={`${tierStyles[k].label} text-white px-2 py-1 rounded text-xs font-bold hover:opacity-90 transition`}>{k}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )} */}

            {selectedIds.size > 0 && (
                <div className="mb-3 p-3 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-400 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                            {tierKeys.map((k) => (
                                <button
                                    key={k}
                                    onClick={() => {
                                        moveCandidatesTo(Array.from(selectedIds), k);
                                    }}
                                    className={`${tierStyles[k].label} text-white px-2.5 py-1 rounded-md font-bold text-xs hover:opacity-90 transition`}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isJolaniGroup && (
                <div className="flex justify-center mb-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => downloadAllImages([...bank, ...tierKeys.flatMap(k => tiers[k])])}
                        disabled={isDownloadingAll}
                        className="gap-1.5"
                    >
                        {isDownloadingAll ? (
                            <span className="inline-flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                جاري التحميل...
                            </span>
                        ) : (
                            <>
                                <Download size={14} />
                               تحميل صور جميع الشخصيات
                            </>
                        )}
                    </Button>
                </div>
            )}

            <div className="mb-3 text-sm text-muted-foreground text-center flex flex-wrap gap-2 items-center justify-center">
                <span className="font-semibold text-foreground">شرح المستويات:</span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-white bg-rose-600 font-semibold">
                        S
                    </span>
                    <span>ممتاز</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-white bg-amber-600 font-semibold">
                        A
                    </span>
                    <span>جيد جدًا</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-white bg-emerald-600 font-semibold">
                        B
                    </span>
                    <span>جيد</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-white bg-sky-600 font-semibold">
                        C
                    </span>
                    <span>مقبول</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-white bg-violet-600 font-semibold">
                        D
                    </span>
                    <span>ضعيف</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-white bg-gray-800 font-semibold">
                        F
                    </span>
                    <span>سيئ</span>
                </span>
            </div>

            <div ref={tiersRef} data-capture-target>
                {tierKeys.map((k) => (
                    <div key={k} className="flex mb-1">
                        <div
                            data-tier-label={k}
                            className={`w-20 min-h-[165px] ${tierStyles[k].label} text-white rounded-r flex flex-col items-center justify-center`}
                        >
                            <span className="text-xl font-bold leading-none">{k}</span>
                            <span className="text-[16px] font-bold leading-none mt-4 opacity-90">
                                {tierDescriptions[k]}
                            </span>
                        </div>
                        <div
                            data-tier-area={k}
                            className={`flex flex-wrap justify-center min-h-[165px] flex-grow p-2 border-2 border-dashed ${tierStyles[k].border} ${tierStyles[k].area} dark:bg-background rounded-l`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, k)}
                        >
                            {tiers[k].map((c) => {
                                const selected = selectedIds.has(c.id);
                                return (
                                    <div
                                        key={c.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, c.id)}
                                        onClick={() => toggleSelected(c.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                toggleSelected(c.id);
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        className={`group relative flex flex-col items-center gap-1 mr-2 mb-2 outline h-auto p-2 pt-3 cursor-pointer select-none rounded-md transition-all active:scale-95 ${selected
                                                ? "bg-purple-600 hover:bg-purple-600 text-white outline-2 outline-purple-400 font-semibold"
                                                : "bg-card text-foreground border border-border hover:bg-muted"
                                            } w-[104px] sm:w-[120px]`}
                                        data-selected={selected ? "1" : undefined}
                                    >
                                        {isJolaniGroup && c.imageUrl && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); downloadImage(c.imageUrl!, c.name); }}
                                                className="absolute top-1 left-1 z-10 p-0.5 rounded bg-black/50 text-white hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                                title="تحميل الصورة"
                                            >
                                                <Download size={14} />
                                            </button>
                                        )}
                                        <Avatar
                                            src={c.imageUrl || ""}
                                            alt={c.name}
                                            size={48}
                                            className="mb-1 pointer-events-none"
                                        />
                                        <span className="text-xs text-center leading-tight pointer-events-none">
                                            {c.name}
                                        </span>
                                        {c.title ? (
                                            <span className={`text-[11px] text-muted-foreground text-center leading-tight pointer-events-none ${selected ? "text-white" : ""}`}>{c.title}</span>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3 justify-center mt-6 p-4">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={submit}
                    disabled={isSubmitting}
                    className="dark:bg-green-600 dark:hover:bg-green-500 dark:text-white"
                >
                    {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                            <svg
                                className="animate-spin h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                            </svg>
                            جاري الإرسال...
                        </span>
                    ) : (
                        "إرسال"
                    )}
                </Button>
                <Button
                    type="button"
                    onClick={saveImage}
                    disabled={isSubmitting || isSaving}
                >
                    {isSaving ? (
                        <span className="inline-flex items-center gap-2">
                            <svg
                                className="animate-spin h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                            </svg>
                            جاري التحضير...
                        </span>
                    ) : (
                        "حفظ كصورة"
                    )}
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                        setBank(shuffledInitial);
                        setTiers(createEmptyTiers());
                        setSelectedIds(new Set());
                    }}
                >
                    مسح الاختيارات
                </Button>
            </div>
            {submitStatus && (
                <div className="px-4 pb-2">
                    <Alert variant={submitStatus.ok ? "default" : "destructive"}>
                        {submitStatus.ok ? (
                            <CheckCircle2Icon className="h-5 w-5" />
                        ) : (
                            <AlertCircleIcon className="h-5 w-5" />
                        )}
                        <AlertTitle>{submitStatus.message}</AlertTitle>
                        {submitStatus.description ? (
                            <AlertDescription>{submitStatus.description}</AlertDescription>
                        ) : null}
                    </Alert>
                </div>
            )}
        </Card>
    );
}
