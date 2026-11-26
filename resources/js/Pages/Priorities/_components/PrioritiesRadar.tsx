import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface PrioritiesRadarRow {
  topic: string;
  current: number;
  comparison: number;
}

/**
 * The radar drawing in PrioritiesApp. It is its own module so recharts loads
 * after the page instead of with it: the surrounding card and its text table
 * render (and server-render) without it.
 */
export default function PrioritiesRadar({
  data,
  comparisonTitle,
  primary,
  labelColor,
}: {
  data: PrioritiesRadarRow[];
  comparisonTitle: string;
  primary: string;
  labelColor: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data} accessibilityLayer={false}>
        <PolarGrid stroke="rgba(128, 128, 128, 0.15)" />
        <PolarAngleAxis
          dataKey="topic"
          tick={{
            fontSize: 10,
            fontWeight: 'bold',
            fontFamily: 'IBM Plex Sans Arabic',
            fill: labelColor
          }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 45]}
          tick={false}
          axisLine={false}
        />
        <RechartsTooltip
          formatter={(value, name) => {
            const label = name === 'current' ? 'نقاط موازنتك الحالية' : comparisonTitle;
            return [`%${String(value ?? '')}`, label];
          }}
        />
        <Legend
          formatter={(value: string) => value === 'current' ? 'نقاط موازنتك الحالية' : comparisonTitle}
        />
        <Radar
          name="current"
          dataKey="current"
          stroke={primary}
          strokeWidth={2.5}
          fill={primary}
          fillOpacity={0.15}
          dot={{ r: 4, fill: primary, stroke: '#fff', strokeWidth: 1 }}
        />
        <Radar
          name="comparison"
          dataKey="comparison"
          stroke="rgba(128, 128, 128, 0.6)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="rgba(128, 128, 128, 0.05)"
          fillOpacity={1}
          dot={{ r: 3, fill: 'rgba(128, 128, 128, 0.8)', stroke: '#fff', strokeWidth: 1 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
