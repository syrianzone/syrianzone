import { lazy, Suspense, useCallback, useId, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card"
import { Button } from "@/Components/ui/button"
import { cn } from "@/Lib/utils"
import { Share2 } from "lucide-react"
import BrandShareFrame, { MADAR_DISPLAY_FONT } from "@/Components/share/BrandShareFrame"
import ShareImageDialog from "@/Components/share/ShareImageDialog"

// recharts is the heaviest dependency of the leaderboard and draws nothing on
// the server (ResponsiveContainer has no size there), so only the drawing is
// loaded on demand; the fixed-height box around it keeps the layout still.
const TimeseriesLines = lazy(() => import("./TimeseriesLines"))

const CHART_BACKGROUND = '#020817'
const CHART_FOREGROUND = '#f8fafc'

interface HistoryPoint {
    date: string
    votes: number
    score: number
}

interface ItemHistory {
    [candidateId: string]: HistoryPoint[]
}

/** One candidate row: the chart keys the series by `candidateId` and labels it by `name`. */
interface ChartCandidate {
    candidateId: string
    name: string
}

interface TimeseriesChartProps {
    history: ItemHistory
    candidates: readonly ChartCandidate[]
    title: string
}

type Timeframe = "day" | "week" | "month" | "year"

/**
 * "YYYY-MM-DD" as a local calendar date. `new Date("YYYY-MM-DD")` is UTC
 * midnight, which is the previous day west of Greenwich and makes the server
 * and the browser disagree.
 */
function localDate(day: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(day)
}

/** A local date back to "YYYY-MM-DD" (toISOString would shift it to UTC). */
function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
type Metric = "votes" | "score"
type ViewMode = "cumulative" | "periodic"

const VIEW_MODES: readonly { value: ViewMode; label: string }[] = [
    { value: "cumulative", label: "تراكمي" },
    { value: "periodic", label: "دوري" },
]

const METRICS: readonly { value: Metric; label: string }[] = [
    { value: "score", label: "النقاط" },
    { value: "votes", label: "الأصوات" },
]

const TIMEFRAMES: readonly { value: Timeframe; label: string }[] = [
    { value: "day", label: "يومي" },
    { value: "week", label: "أسبوعي" },
    { value: "month", label: "شهري" },
    { value: "year", label: "سنوي" },
]

/**
 * One row of bound options for the chart below it. These are not tabs: nothing
 * is switched, the single chart is redrawn. As Radix tabs they named a
 * TabsContent that was never rendered (axe: aria-valid-attr-value).
 */
function OptionGroup<T extends string>({
    label, value, options, onChange, className,
}: {
    label: string
    value: T
    options: readonly { value: T; label: string }[]
    onChange: (value: T) => void
    className: string
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className={cn("h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        value === option.value && "bg-background text-foreground shadow-sm",
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

export function TimeseriesChart({ history, candidates, title }: TimeseriesChartProps) {
    const [timeframe, setTimeframe] = useState<Timeframe>("day")
    const [metric, setMetric] = useState<Metric>("score")
    const [viewMode, setViewMode] = useState<ViewMode>("cumulative")
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>(["all"])

    const toggleCandidate = (id: string) => {
        if (id === "all") {
            setSelectedCandidates(["all"])
            return
        }

        let newSelection = [...selectedCandidates]
        if (newSelection.includes("all")) {
            newSelection = []
        }

        if (newSelection.includes(id)) {
            newSelection = newSelection.filter(c => c !== id)
        } else {
            newSelection.push(id)
        }

        if (newSelection.length === 0) {
            newSelection = ["all"]
        }

        setSelectedCandidates(newSelection)
    }

    const chartData = useMemo(() => {
        const dataMap: { [date: string]: any } = {}

        const allDates = new Set<string>()
        Object.values(history).forEach(points => {
            points.forEach(p => allDates.add(p.date))
        })

        const sortedDates = Array.from(allDates).sort()

        const dailyData: any[] = []
        const runningTotals: { [key: string]: number } = {}
        candidates.forEach(c => runningTotals[c.candidateId] = 0)

        const getRaw = (date: string, cId: string) => {
            const pts = history[cId]
            const p = pts?.find(x => x.date === date)
            return p ? p[metric] : 0
        }

        sortedDates.forEach(date => {
            const entry: any = { date, originalDate: date }
            candidates.forEach(c => {
                const val = getRaw(date, c.candidateId)
                if (viewMode === "cumulative") {
                    runningTotals[c.candidateId] += val
                    entry[c.candidateId] = runningTotals[c.candidateId]
                } else {
                    entry[c.candidateId] = val
                }
            })
            dailyData.push(entry)
        })

        if (timeframe === "day") {
            return dailyData.map(d => ({
                ...d,
                displayDate: localDate(d.date).toLocaleDateString('ar-SY-u-nu-latn')
            }))
        }

        const aggregatedMap: { [key: string]: any } = {}

        dailyData.forEach(dayEntry => {
            const dateObj = localDate(dayEntry.date)
            let key = ""

            if (timeframe === "week") {
                const day = dateObj.getDay()
                const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1)
                key = dayKey(new Date(dateObj.getFullYear(), dateObj.getMonth(), diff))
            } else if (timeframe === "month") {
                key = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}`
            } else if (timeframe === "year") {
                key = `${dateObj.getFullYear()}`
            }

            if (!aggregatedMap[key]) {
                aggregatedMap[key] = { displayDate: key, originalDate: dayEntry.date }
                candidates.forEach(c => aggregatedMap[key][c.candidateId] = 0)
            }

            if (viewMode === "cumulative") {
                const merged = { ...aggregatedMap[key], ...dayEntry }
                aggregatedMap[key] = merged
            } else {
                candidates.forEach(c => {
                    aggregatedMap[key][c.candidateId] += (dayEntry[c.candidateId] || 0)
                })
            }

            if (timeframe === "month") {
                aggregatedMap[key].displayDate = dateObj.toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric', month: 'short' })
            } else if (timeframe === "year") {
                aggregatedMap[key].displayDate = dateObj.toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric' })
            } else if (timeframe === "week") {
                aggregatedMap[key].displayDate = localDate(key).toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'numeric' })
            }
        })

        return Object.values(aggregatedMap)
    }, [history, candidates, metric, timeframe, viewMode])

    const filteredCandidates = selectedCandidates.includes("all")
        ? candidates
        : candidates.filter(c => selectedCandidates.includes(c.candidateId))

    // Limit legend/lines if "all" is selected to avoid chaos, but user can explicitly select many
    const displayCandidates = selectedCandidates.includes("all")
        ? filteredCandidates.slice(0, 5)
        : filteredCandidates

    const colors = [
        "#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea",
        "#0891b2", "#be185d", "#4f46e5", "#ca8a04", "#059669"
    ]

    const getCandidateColor = (cId: string) => {
        const idx = candidates.findIndex(c => c.candidateId === cId)
        return colors[idx % colors.length]
    }

    const chartId = useId()
    // The drawing loads on demand; until it has mounted, a share preview would
    // capture the empty placeholder.
    const [chartReady, setChartReady] = useState(false)
    const [shareOpen, setShareOpen] = useState(false)
    const markChartReady = useCallback(() => setChartReady(true), [])

    const chartLines = useMemo(
        () =>
            displayCandidates.map((candidate) => ({
                key: candidate.candidateId,
                name: candidate.name,
                color: getCandidateColor(candidate.candidateId),
            })),
        [displayCandidates, candidates],
    )

    const subtitleText = [
        METRICS.find((m) => m.value === metric)?.label,
        VIEW_MODES.find((v) => v.value === viewMode)?.label,
        TIMEFRAMES.find((t) => t.value === timeframe)?.label,
    ]
        .filter(Boolean)
        .join(' · ')

    return (
        <Card className="mb-8">
            <CardHeader>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <CardTitle>{title}</CardTitle>
                            <CardDescription>تقدم المرشحين عبر الزمن</CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <OptionGroup
                                label="طريقة العرض"
                                value={viewMode}
                                options={VIEW_MODES}
                                onChange={setViewMode}
                                className="grid w-[160px] grid-cols-2"
                            />

                            <OptionGroup
                                label="القيمة المعروضة"
                                value={metric}
                                options={METRICS}
                                onChange={setMetric}
                                className="grid w-[160px] grid-cols-2"
                            />

                            <OptionGroup
                                label="المدى الزمني"
                                value={timeframe}
                                options={TIMEFRAMES}
                                onChange={setTimeframe}
                                className="grid w-[280px] grid-cols-4"
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* 
                    Inline styles for backgroundColor and color keep the card's own
                    palette, so 'lab()' colours never reach html2canvas.
                */}
                <div id={chartId} style={{ backgroundColor: CHART_BACKGROUND, color: CHART_FOREGROUND, padding: '16px', borderRadius: '8px' }}>
                    <div className="h-[300px] w-full" dir="ltr">
                        <Suspense fallback={null}>
                            <TimeseriesLines
                                data={chartData}
                                lines={chartLines}
                                onReady={markChartReady}
                            />
                        </Suspense>
                    </div>

                    {/* Candidate Selector Pills */}
                    <div className="mt-6" data-chart-controls data-share-exclude>
                        <div className="text-sm font-semibold mb-3 text-gray-400">اختر للعرض:</div>
                        <div role="group" aria-label="المرشحون المعروضون في المخطط" className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                aria-pressed={selectedCandidates.includes("all")}
                                className={`cursor-pointer px-3 py-1 rounded-full text-xs border transition-colors ${selectedCandidates.includes("all") ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"}`}
                                onClick={() => toggleCandidate("all")}
                            >
                                الكل (أفضل 5)
                            </button>
                            {candidates.map(candidate => {
                                const isSelected = selectedCandidates.includes(candidate.candidateId)
                                const color = getCandidateColor(candidate.candidateId)
                                return (
                                    <button
                                        type="button"
                                        key={candidate.candidateId}
                                        aria-pressed={isSelected}
                                        onClick={() => toggleCandidate(candidate.candidateId)}
                                        className={`cursor-pointer px-3 py-1 rounded-full text-xs border flex items-center gap-2 transition-colors ${isSelected ? "text-white" : "text-gray-400"}`}
                                        style={{ borderColor: isSelected ? color : '#374151', backgroundColor: isSelected ? '#1e293b' : 'transparent' }}
                                    >
                                        <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                                        {candidate.name}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* The chart is an SVG picture; this table is its text equivalent.
                    It sits outside chartRef, so the PNG export never includes it. */}
                <div className="sr-only"><table>
                    <caption>{`${title}: ${METRICS.find((m) => m.value === metric)?.label ?? ""}، ${VIEW_MODES.find((v) => v.value === viewMode)?.label ?? ""}`}</caption>
                    <thead>
                        <tr>
                            <th scope="col">التاريخ</th>
                            {displayCandidates.map((c) => (
                                <th key={c.candidateId} scope="col">{c.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {chartData.map((row) => (
                            <tr key={row.originalDate}>
                                <th scope="row">{row.displayDate}</th>
                                {displayCandidates.map((c) => (
                                    <td key={c.candidateId}>{row[c.candidateId] ?? 0}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table></div>

                <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} disabled={!chartReady} className="gap-2">
                        <Share2 className="w-4 h-4" aria-hidden="true" />
                        مشاركة صورة المخطط
                    </Button>
                </div>

                <ShareImageDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    title="مشاركة صورة المخطط"
                    description="معاينة مخطط تقدم المرشحين بهوية المساحة السورية."
                    filename={`syrianzone-polls-chart-${Date.now()}.png`}
                    shareTitle={title}
                    previewMaxWidth={520}
                    exportOptions={{ scale: 2 }}
                    renderCard={({ themeId, cardRef }) => (
                        <BrandShareFrame
                            ref={cardRef}
                            id={`${chartId}-share`}
                            themeId={themeId}
                            moduleLabel="تقدم المرشحين"
                            shareUrl="syrian.zone/polls"
                            format="landscape"
                            width={680}
                        >
                            {(tokens) => (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                                        <div
                                            style={{
                                                fontFamily: MADAR_DISPLAY_FONT,
                                                fontSize: 24,
                                                fontWeight: 900,
                                                color: tokens.ink,
                                                lineHeight: 1.25,
                                            }}
                                        >
                                            {title}
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: tokens.muted,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {subtitleText}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            borderRadius: 12,
                                            backgroundColor: tokens.card,
                                            border: `1px solid ${tokens.border}`,
                                            padding: '14px 12px 10px',
                                        }}
                                    >
                                        <div style={{ height: 270, width: '100%' }} dir="ltr">
                                            <Suspense fallback={null}>
                                                <TimeseriesLines data={chartData} lines={chartLines} />
                                            </Suspense>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                        {chartLines.map((line) => (
                                            <span
                                                key={line.key}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: tokens.ink,
                                                }}
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    style={{
                                                        width: 9,
                                                        height: 9,
                                                        borderRadius: '50%',
                                                        backgroundColor: line.color,
                                                        display: 'inline-block',
                                                    }}
                                                />
                                                {line.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </BrandShareFrame>
                    )}
                />
            </CardContent>
        </Card>
    )
}
