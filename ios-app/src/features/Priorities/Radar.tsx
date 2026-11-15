import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../ui/theme';
import { COMPARISONS, INITIAL_TOPICS, type PriorityState } from './model';

const labels = ['الاقتصاد', 'العدالة', 'السكن', 'الأمن', 'السياسة', 'الرقمنة'];
export function PriorityRadar({ state, comparison }: { state: PriorityState; comparison: string }): React.JSX.Element {
  const { colors } = useTheme();
  const point = (index: number, radius: number) => ({ x: 180 + Math.cos(index * Math.PI / 3 - Math.PI / 2) * radius, y: 145 + Math.sin(index * Math.PI / 3 - Math.PI / 2) * radius });
  const polygon = (values: number[]) => values.map((value, index) => { const p = point(index, value); return `${p.x},${p.y}`; }).join(' ');
  const reference = COMPARISONS[comparison];
  return <Svg width="100%" height={290} viewBox="0 0 360 290" accessibilityRole="image" accessibilityLabel={INITIAL_TOPICS.map((topic, index) => `${labels[index]} ${state.points[topic.id] ?? 0} بالمئة`).join('، ')}>
    {[25, 50, 75, 100].map(radius => <Polygon key={radius} points={polygon(INITIAL_TOPICS.map(() => radius))} fill="none" stroke={colors.separator} strokeWidth={1} />)}
    {INITIAL_TOPICS.map((topic, index) => { const end = point(index, 100); return <Line key={topic.id} x1={180} y1={145} x2={end.x} y2={end.y} stroke={colors.separator} />; })}
    {reference ? <Polygon points={polygon(INITIAL_TOPICS.map(topic => reference.points[topic.id] ?? 0))} fill={colors.secondary} fillOpacity={0.1} stroke={colors.secondary} strokeDasharray="5,4" strokeWidth={2} /> : null}
    <Polygon points={polygon(INITIAL_TOPICS.map(topic => state.points[topic.id] ?? 0))} fill={colors.accent} fillOpacity={0.25} stroke={colors.accent} strokeWidth={3} />
    {labels.map((label, index) => { const p = point(index, 127); return <SvgText key={label} x={p.x} y={p.y + 5} fill={colors.text} fontSize={15} fontWeight="600" textAnchor="middle">{label}</SvgText>; })}
  </Svg>;
}
// PORT STATUS: source resources/js/Pages/Priorities/PrioritiesApp.tsx; confidence medium; todos 0.
