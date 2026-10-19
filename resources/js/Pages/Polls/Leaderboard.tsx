import React, { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import axios from 'axios';
import { Card, CardContent } from "@/Components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { AlertCircleIcon, Vote } from "lucide-react";
import { TierAvatar as Avatar } from "@/Components/poll/TierAvatar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { TimeseriesChart } from "@/Components/charts/TimeseriesChart";
import MainLayout from '@/Layouts/MainLayout';

type StatusFilter = "active" | "former" | "all";

// Canonical vocabulary: active | former | all. 'archived' (the DB value) is
// accepted by the API as an alias and normalized here for shareable URLs.
function normalizeStatus(v: unknown): StatusFilter {
    if (v === "former" || v === "archived") return "former";
    if (v === "all") return "all";
    return "active";
}

function initialStatus(props: LeaderboardData): StatusFilter {
    if (typeof window !== "undefined") {
        const q = new URLSearchParams(window.location.search).get("status");
        if (q) return normalizeStatus(q);
    }
    return normalizeStatus(props.status);
}

function timeAgo(iso?: string | null): string | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return "قبل لحظات";
    const m = Math.floor(s / 60);
    if (m < 60) return `قبل ${m} د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `قبل ${h} س`;
    const d = Math.floor(h / 24);
    return `قبل ${d} يوم`;
}

interface LeaderboardEntry {
    candidateId: string;
    name: string;
    title?: string | null;
    imageUrl?: string | null;
    votes: number;
    score: number;
    avg: number;
    rank: number;
    status?: "active" | "archived";
    termStartedAt?: string | null;
    termEndedAt?: string | null;
    archiveReason?: string | null;
    successorId?: string | null;
}

interface LeaderboardGroup {
    id: string;
    name: string;
    key?: string | null;
    /** Server-normalized rankings key (e.g. the `minister` group ranks under `ministers`). */
    rankingKey?: string;
    isDefault?: boolean;
}

interface LeaderboardData {
    poll: { id: string; title: string; slug?: string };
    status?: string;
    generated_at?: string | null;
    groups?: LeaderboardGroup[];
    [key: string]: any;
}

interface LeaderboardProps extends LeaderboardData {}

function formatNumberKM(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

// The tabs are the *published* categories the server sent. A disabled category
// is not in `groups`, so it gets no tab and its rows are never read — the fix
// belongs here rather than in the query, because the tab strip used to be a
// hardcoded list of four keys.
function publishedGroups(data: LeaderboardData): LeaderboardGroup[] {
    return Array.isArray(data.groups) ? data.groups : [];
}

function groupKey(group: LeaderboardGroup): string {
    return group.rankingKey || group.key || group.id;
}

function rowsFor(data: LeaderboardData, group: LeaderboardGroup): LeaderboardEntry[] {
    return data[groupKey(group)] || [];
}

function buildSuccessorIndex(groups: LeaderboardGroup[], data: LeaderboardData): Record<string, string> {
    const index: Record<string, string> = {};
    for (const group of groups) {
        for (const row of rowsFor(data, group)) index[row.candidateId] = row.name;
    }
    return index;
}

function FormerBadge({ row, successorName }: { row: LeaderboardEntry; successorName?: string }) {
    if (row.status !== "archived") return null;
    return (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">سابق</Badge>
            {row.termEndedAt && <span>حتى {row.termEndedAt}</span>}
            {row.archiveReason && <span>· {row.archiveReason}</span>}
            {successorName && <span>· خلفه {successorName}</span>}
        </div>
    );
}

function LeaderboardTable({
    rows,
    title,
    successorIndex,
}: {
    rows: LeaderboardEntry[];
    title: string;
    successorIndex: Record<string, string>;
}) {
    if (!rows.length) return null;
    return (
        <div className="mb-8">
            <h2 className="font-semibold mb-2">{title}</h2>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-3 text-right w-12">#</th>
                                    <th className="p-3 text-right">المسؤول</th>
                                    <th className="p-3 text-right w-20">النقاط</th>
                                    <th className="p-3 text-right w-16">الأصوات</th>
                                    <th className="p-3 text-right w-20">المعدّل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const isFormer = r.status === "archived";
                                    return (
                                        <tr
                                            key={r.candidateId}
                                            className={`border-b last:border-0 ${isFormer ? "opacity-70" : ""}`}
                                        >
                                            <td className="p-3">#{r.rank}</td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <Avatar src={r.imageUrl || ""} alt={r.name} size={28} />
                                                    <div>
                                                        <div className="text-sm">{r.name}</div>
                                                        {r.title && <div className="text-xs text-gray-500">{r.title}</div>}
                                                        <FormerBadge
                                                            row={r}
                                                            successorName={r.successorId ? successorIndex[r.successorId] : undefined}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3">{formatNumberKM(r.score)}</td>
                                            <td className="p-3">{formatNumberKM(r.votes)}</td>
                                            <td className="p-3">{r.avg.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function Top3Podium({ rows, title }: { rows: LeaderboardEntry[]; title: string }) {
    if (rows.length < 3) return null;
    const [first, second, third] = rows;
    return (
        <div className="max-w-screen-md mx-auto mb-8">
            <h2 className="font-semibold mb-4 text-center text-gray-500">{title}</h2>
            <div className="grid grid-cols-3 items-end justify-items-center gap-4">
                {/* 2nd */}
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Avatar src={second.imageUrl || ""} alt={second.name} size={48} />
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-900 text-white text-[10px] border border-white flex items-center justify-center">2</span>
                    </div>
                    <div className="text-sm mt-1 text-center leading-tight mb-2">{second.name}</div>
                    {second.title && <div className="text-xs text-gray-500 text-center">{second.title}</div>}
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Avatar src={first.imageUrl || ""} alt={first.name} size={64} />
                        <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-green-900 text-white text-[10px] border border-white flex items-center justify-center">1</span>
                    </div>
                    <div className="font-medium mt-1 text-center leading-tight mb-2">{first.name}</div>
                    {first.title && <div className="text-xs text-gray-500 text-center">{first.title}</div>}
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Avatar src={third.imageUrl || ""} alt={third.name} size={48} />
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-900 text-white text-[10px] border border-white flex items-center justify-center">3</span>
                    </div>
                    <div className="text-sm mt-1 text-center leading-tight mb-2">{third.name}</div>
                    {third.title && <div className="text-xs text-gray-500 text-center">{third.title}</div>}
                </div>
            </div>
        </div>
    );
}

function StatusToggle({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
    const options: { value: StatusFilter; label: string }[] = [
        { value: "active", label: "الحاليون" },
        { value: "former", label: "السابقون" },
        { value: "all", label: "الكل" },
    ];
    return (
        <div className="inline-flex rounded-md border bg-background p-0.5 text-sm">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-3 py-1 rounded-sm transition-colors ${
                        value === o.value ? "bg-primary text-primary-foreground" : "text-gray-600 hover:bg-muted"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function Leaderboard(initialProps: LeaderboardProps) {
    const [data, setData] = useState<LeaderboardData>(initialProps);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<StatusFilter>(() => initialStatus(initialProps));
    const initialStatusRef = React.useRef<StatusFilter>(initialStatus(initialProps));
    const firstFetchRef = React.useRef(true);

    const handleStatusChange = (v: StatusFilter) => {
        setStatus(v);
        // Shareable view: keep ?status= in the URL so filtered views link correctly.
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("status", v);
            window.history.replaceState(null, "", url.toString());
        }
    };

    useEffect(() => {
        // SSR already rendered this status — don't refetch on mount.
        if (firstFetchRef.current) {
            firstFetchRef.current = false;
            if (status === initialStatusRef.current) return;
        }
        setLoading(true);
        axios
            .get(`/api/polls/${initialProps.poll.slug}/leaderboard`, { params: { status } })
            .then((response) => {
                setData(response.data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching leaderboard:", err);
                setLoading(false);
            });
    }, [status]);

    if (loading && !data) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 pt-10 pb-8">
                    <div className="text-center text-gray-600 dark:text-gray-400">جاري التحميل...</div>
                </div>
            </MainLayout>
        );
    }

    const groups = publishedGroups(data);
    const successorIndex = buildSuccessorIndex(groups, data);
    const defaultGroup = groups.find((g) => g.isDefault) ?? groups[0];
    const defaultKey = defaultGroup ? groupKey(defaultGroup) : "ministers";

    return (
        <MainLayout>
            
            <div className="container mx-auto px-4 pt-6 pb-8" dir="rtl">
                {/* Vote Link */}
                <div className="max-w-screen-md mx-auto mb-4 flex justify-end">
                    <Link href="/tierlist">
                        <Button variant="outline" className="gap-2">
                            <Vote className="h-4 w-4" />
                            صوّت الآن
                        </Button>
                    </Link>
                </div>

                <div className="max-w-screen-md mx-auto mb-4">
                    <Alert>
                        <AlertCircleIcon className="h-5 w-5" />
                        <div>
                            <AlertTitle>تنويه</AlertTitle>
                            <AlertDescription>
                                هذه منصة تصويت جماهيرية ذات طابع مجتمعي، وغايتها إتاحة مساحة للتعبير والمشاركة في القضايا المطروحة. وما يُنشر من نتائج يعكس أصوات المشاركين وتوجهاتهم، ولا يمثل رأياً رسمياً، ولا يرتبط بأي جهة حكومية.
                            </AlertDescription>
                        </div>
                    </Alert>
                </div>

                <h1 className="text-2xl font-bold mb-1 text-center">الإحصائيات</h1>
                {(() => {
                    const ago = timeAgo(data.generated_at);
                    if (!ago) return <div className="mb-4" />;
                    return (
                        <p className="text-xs text-gray-500 text-center mb-4" title={data.generated_at ?? undefined}>
                            {ago} · حدّث الصفحة لأحدث النتائج
                        </p>
                    );
                })()}

                {groups.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        لا توجد تصنيفات منشورة حالياً.
                    </div>
                )}

                {groups.length > 0 && data.history && (
                    <Tabs defaultValue={defaultKey} dir="rtl" className="w-full">
                        <div className="flex flex-col items-center gap-3 mb-6">
                            <TabsList className="flex h-auto w-full max-w-2xl flex-wrap justify-center gap-1">
                                {groups.map((group) => (
                                    <TabsTrigger key={groupKey(group)} value={groupKey(group)}>
                                        {group.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <StatusToggle value={status} onChange={handleStatusChange} />
                        </div>

                        {groups.map((group) => {
                            const rows = rowsFor(data, group);
                            return (
                                <TabsContent key={groupKey(group)} value={groupKey(group)}>
                                    <TimeseriesChart
                                        history={data.history}
                                        candidates={rows}
                                        title={`تقدم ${group.name}`}
                                    />
                                    {rows.length >= 3 && (
                                        <Top3Podium rows={rows.slice(0, 3)} title={`أفضل ٣ - ${group.name}`} />
                                    )}
                                    <LeaderboardTable
                                        rows={rows}
                                        title={`قائمة ${group.name}`}
                                        successorIndex={successorIndex}
                                    />
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                )}

                {defaultGroup && !data.history && (
                    <>
                        <div className="text-center text-red-500 mb-4">بيانات التاريخ غير متوفرة</div>
                        <div className="max-w-screen-md mx-auto">
                            <LeaderboardTable
                                rows={rowsFor(data, defaultGroup)}
                                title={`قائمة ${defaultGroup.name}`}
                                successorIndex={successorIndex}
                            />
                        </div>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
