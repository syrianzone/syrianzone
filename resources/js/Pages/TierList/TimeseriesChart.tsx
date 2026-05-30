"use client"

import { useMemo, useState, useRef } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/Components/ui/tabs"
import { Button } from "@/Components/ui/button"
import { Download } from "lucide-react"
import html2canvas from "html2canvas"

interface HistoryPoint {
    date: string
    votes: number
    score: number
}

interface ItemHistory {
    [candidateId: string]: HistoryPoint[]
}

interface TimeseriesChartProps {
    history: ItemHistory
    candidates: any[]
    title: string
}

export function TimeseriesChart({ history, candidates, title }: TimeseriesChartProps) {
    const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year">("day")
    const [metric, setMetric] = useState<"votes" | "score">("score")
    const [viewMode, setViewMode] = useState<"cumulative" | "periodic">("cumulative")
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>(["all"])

    // Toggle candidate selection
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

    // Transform data for Recharts
    const chartData = useMemo(() => {
        const dataMap: { [date: string]: any } = {}

        // Get all unique dates
        const allDates = new Set<string>()
        Object.values(history).forEach(points => {
            points.forEach(p => allDates.add(p.date))
        })

        const sortedDates = Array.from(allDates).sort()

        // 1. Calculate Daily Values (Cumulative or Periodic)
        const dailyData: any[] = []
        const runningTotals: { [key: string]: number } = {}
        candidates.forEach(c => runningTotals[c.candidateId] = 0)

        // Helper to get raw daily value
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

        // 2. Aggregate for Week/Month/Year
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
                // Initialize counts for this period
                candidates.forEach(c => aggregatedMap[key][c.candidateId] = 0)
            }

            if (viewMode === "cumulative") {
                // For cumulative, we want the LAST value in the period
                // So we just overwrite with the current dayEntry values
                // But we must respect the initialization if this is the first entry
                // Actually dayEntry has date/originalDate, aggregatedMap has displayDate.
                const merged = { ...aggregatedMap[key], ...dayEntry }
                aggregatedMap[key] = merged
            } else {
                // For periodic, we SUM the values within the period
                candidates.forEach(c => {
                    aggregatedMap[key][c.candidateId] += (dayEntry[c.candidateId] || 0)
                })
            }

            // Refine display label
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

    // Assign a color to each candidate consistently based on their index in the full list
    const getCandidateColor = (cId: string) => {
        const idx = candidates.findIndex(c => c.candidateId === cId)
        return colors[idx % colors.length]
    }

    const chartRef = useRef<HTMLDivElement>(null)

    const handleDownload = async () => {
        if (!chartRef.current) return

        try {
            const canvas = await html2canvas(chartRef.current, {
                backgroundColor: "#020817",
                scale: 2,
                useCORS: true,
                onclone: (clonedDoc: Document) => {
                    const element = clonedDoc.querySelector('[data-chart-container]') as HTMLElement
                    if (element) {
                        // Double enforce styles in the clone
                        element.style.backgroundColor = '#020817'
                        element.style.color = '#f8fafc'
                        element.style.direction = 'rtl' // Ensure RTL is preserved
                        element.style.textAlign = 'right'
                        // element.style.fontFamily = 'Arial, sans-serif' // optional: ensure consistent font rendering

                        // Fix spacing/overflow issues in export by expanding width slightly if needed or unsetting max-width
                        // element.style.width = '1200px' // optional: force wide capture

                        // Try to strip potential lab colors from children if possible
                        const children = element.querySelectorAll('*') as NodeListOf<HTMLElement>
                        children.forEach(child => {
                            const style = window.getComputedStyle(child)
                            if (style.borderColor && style.borderColor.includes('lab')) {
                                child.style.borderColor = '#1e293b' // fallback border
                            }
                            if (style.backgroundColor && style.backgroundColor.includes('lab')) {
                                child.style.backgroundColor = '#020817' // fallback bg
                            }
                            if (style.color && style.color.includes('lab')) {
                                child.style.color = '#f8fafc' // fallback text
                            }
                        })

                        // Hide controls in export
                        const controls = clonedDoc.querySelector('[data-chart-controls]') as HTMLElement
                        if (controls) {
                            controls.style.display = 'none'
                        }
                    }
                }
            } as any)

            const link = document.createElement('a')
            link.download = `chart-${new Date().getTime()}.png`
            link.href = canvas.toDataURL()
            link.click()
        } catch (err) {
            console.error("Failed to download chart image", err)
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
                    Using inline styles for backgroundColor and color to prevent inheritence of 'lab()' colors 
                    that cause html2canvas to crash.
                */}
                <div ref={chartRef} data-chart-container style={{ backgroundColor: '#020817', color: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
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
