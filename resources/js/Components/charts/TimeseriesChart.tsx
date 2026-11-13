import { useId, useMemo, useState, useRef } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/Components/ui/tabs"
import { Button } from "@/Components/ui/button"
import { Download } from "lucide-react"
import { notify } from "@/Lib/notify"
import type { PngDeclarations } from "@/Lib/exportElementAsPng"

/** The card paints its own fixed dark palette so the export never depends on the theme. */
const CHART_BACKGROUND = '#020817'
const CHART_FOREGROUND = '#f8fafc'
const CHART_BORDER = '#1e293b'

/** html2canvas cannot parse oklch/oklab/color-mix: keep the card's own tones instead. */
const CHART_PNG_OPTIONS = {
    scale: 2,
    backgroundColor: CHART_BACKGROUND,
    removeSelectors: ['[data-chart-controls]'],
    colorPolicy: (node: HTMLElement, style: CSSStyleDeclaration): PngDeclarations => {
        const modern = (value: string | undefined): value is string =>
            !!value && (value.includes('oklch') || value.includes('oklab') || value.includes('color-mix'))
        const declarations: PngDeclarations = {}
        if (modern(style.backgroundColor)) declarations['background-color'] = CHART_BACKGROUND
        if (modern(style.color)) declarations.color = CHART_FOREGROUND
        if (modern(style.borderColor)) declarations['border-color'] = CHART_BORDER
        if (modern(style.backgroundImage)) declarations['background-image'] = 'none'
        return declarations
    },
}

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

export function TimeseriesChart({ history, candidates, title }: TimeseriesChartProps) {
    const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year">("day")
    const [metric, setMetric] = useState<"votes" | "score">("score")
    const [viewMode, setViewMode] = useState<"cumulative" | "periodic">("cumulative")
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
                displayDate: new Date(d.date).toLocaleDateString('ar-SY')
            }))
        }

        const aggregatedMap: { [key: string]: any } = {}

        dailyData.forEach(dayEntry => {
            const dateObj = new Date(dayEntry.date)
            let key = ""

            if (timeframe === "week") {
                const d = new Date(dateObj)
                const day = d.getDay()
                const diff = d.getDate() - day + (day == 0 ? -6 : 1)
                const monday = new Date(d.setDate(diff))
                key = monday.toISOString().split('T')[0]
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
                aggregatedMap[key].displayDate = new Date(key).toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'numeric' })
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

    const chartRef = useRef<HTMLDivElement>(null)
    // The exporter keeps only the captured node when it has an id, which is how
    // the controls below stay out of the image.
    const chartId = useId()

    const handleDownload = async () => {
        const chart = chartRef.current
        if (!chart) return

        try {
            // Loaded on demand: html2canvas is heavy and only this button needs it.
            const { exportElementAsPng } = await import("@/Lib/exportElementAsPng")
            await exportElementAsPng(chart, `chart-${Date.now()}.png`, CHART_PNG_OPTIONS)
        } catch {
            notify.error('تعذّر إنشاء صورة المخطط، حاول مرة أخرى')
        }
    }

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
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[160px]">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="cumulative">تراكمي</TabsTrigger>
                                    <TabsTrigger value="periodic">دوري</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <Tabs value={metric} onValueChange={(v) => setMetric(v as any)} className="w-[160px]">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="score">النقاط</TabsTrigger>
                                    <TabsTrigger value="votes">الأصوات</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)} className="w-[280px]">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="day">يومي</TabsTrigger>
                                    <TabsTrigger value="week">أسبوعي</TabsTrigger>
                                    <TabsTrigger value="month">شهري</TabsTrigger>
                                    <TabsTrigger value="year">سنوي</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* 
                    Inline styles for backgroundColor and color keep the card's own
                    palette, so 'lab()' colours never reach html2canvas.
                */}
                <div id={chartId} ref={chartRef} style={{ backgroundColor: CHART_BACKGROUND, color: CHART_FOREGROUND, padding: '16px', borderRadius: '8px' }}>
                    <div className="h-[300px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                                <XAxis
                                    dataKey="displayDate"
                                    className="text-xs"
                                    minTickGap={30}
                                    tickMargin={10}
                                />
                                <YAxis className="text-xs" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020817', borderColor: '#1e293b', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                                <Legend />
                                {displayCandidates.map((candidate) => (
                                    <Line
                                        key={candidate.candidateId}
                                        type="monotone"
                                        dataKey={candidate.candidateId}
                                        name={candidate.name}
                                        stroke={getCandidateColor(candidate.candidateId)}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Candidate Selector Pills */}
                    <div className="mt-6" data-chart-controls>
                        <div className="text-sm font-semibold mb-3 text-gray-400">اختر للعرض:</div>
                        <div className="flex flex-wrap gap-2">
                            <div
                                className={`cursor-pointer px-3 py-1 rounded-full text-xs border transition-colors ${selectedCandidates.includes("all") ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"}`}
                                onClick={() => toggleCandidate("all")}
                            >
                                الكل (أفضل 5)
                            </div>
                            {candidates.map(candidate => {
                                const isSelected = selectedCandidates.includes(candidate.candidateId)
                                const color = getCandidateColor(candidate.candidateId)
                                return (
                                    <div
                                        key={candidate.candidateId}
                                        onClick={() => toggleCandidate(candidate.candidateId)}
                                        className={`cursor-pointer px-3 py-1 rounded-full text-xs border flex items-center gap-2 transition-colors ${isSelected ? "text-white" : "text-gray-500 opacity-60 grayscale"}`}
                                        style={{ borderColor: isSelected ? color : '#374151', backgroundColor: isSelected ? '#1e293b' : 'transparent' }}
                                    >
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                                        {candidate.name}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                        <Download className="w-4 h-4" />
                        تحميل الصورة
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
