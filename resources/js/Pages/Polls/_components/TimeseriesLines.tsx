import { useEffect } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

/** One drawn series: the data key, its legend label and its stroke colour. */
export interface TimeseriesLine {
    key: string
    name: string
    color: string
}

/**
 * The recharts drawing behind `TimeseriesChart`. It is its own module so the
 * charting library loads after the leaderboard instead of with it: the card,
 * its controls and the text table render (and server-render) without it.
 * `onReady` fires once the drawing has mounted, so the card can hold its PNG
 * download until there is a chart to capture.
 */
export default function TimeseriesLines({ data, lines, onReady }: { data: object[]; lines: readonly TimeseriesLine[]; onReady?: () => void }) {
    useEffect(() => {
        onReady?.()
    }, [onReady])

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                {lines.map((line) => (
                    <Line
                        key={line.key}
                        type="monotone"
                        dataKey={line.key}
                        name={line.name}
                        stroke={line.color}
                        strokeWidth={2}
                        dot={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    )
}
