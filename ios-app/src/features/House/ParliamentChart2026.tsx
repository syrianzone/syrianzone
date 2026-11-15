import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Heading, Label, Section } from '../../components';
import { NativeAction, NativePicker } from '../../ui/native';
import { groupKey, groupLabel, hemicycleSeats, type Dimension, type Member2026 } from './model';

const palette = ['#cb6d62', '#8a5100', '#8b902d', '#10703a', '#00a5a9', '#005d95', '#a482d2', '#854079', '#556A4E', '#A73F46', '#b5892e', '#5b7fa6', '#7a5c3e', '#4e8a7a'];
export function ParliamentChart2026({ members, dimension, selected, onDimension, onSelect }: { members: Member2026[]; dimension: Dimension; selected: string; onDimension(value: Dimension): void; onSelect(value: string): void }): React.JSX.Element {
  const active = useMemo(() => members.filter(member => (member.status || 'active') === 'active'), [members]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>(); active.forEach(member => { const key = groupKey(member, dimension); counts.set(key, (counts.get(key) ?? 0) + 1); });
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [active, dimension]);
  const seats = useMemo(() => hemicycleSeats(active, dimension), [active, dimension]);
  const color = (group: string): string => {
    if (dimension === 'gender') return group === 'F' ? '#A73F46' : '#556A4E';
    if (dimension === 'selection') return group === 'تعيين' ? '#A73F46' : '#556A4E';
    if (dimension === 'social') return group === 'no_social' ? '#A73F46' : '#556A4E';
    if (dimension === 'age') return ({ lt30: '#00a5a9', '30s': '#8b902d', '40s': '#8a5100', '50s': '#cb6d62', '60p': '#005d95' } as Record<string, string>)[group] ?? '#888888';
    return palette[groups.findIndex(([key]) => key === group) % palette.length] ?? palette[0]!;
  };
  return <Section><Heading subtitle="اختر بُعداً، ثم اضغط على فئة لتصفية قائمة الأعضاء">توزيع مقاعد المجلس</Heading>
    <NativePicker label="توزيع المقاعد حسب" value={dimension} onChange={onDimension} options={[{ value: 'selection', label: 'طريقة التعيين' }, { value: 'governorate', label: 'المحافظة' }, { value: 'gender', label: 'الجنس' }, { value: 'age', label: 'الفئة العمرية' }, { value: 'social', label: 'التواصل الاجتماعي' }]} />
    <Svg width="100%" height={210} viewBox="0 0 400 210" accessibilityRole="image" accessibilityLabel={`${active.length} مقعداً. ${groups.map(([key, count]) => `${groupLabel(key, dimension)} ${count}`).join('، ')}`}>
      {seats.map((seat, index) => <Circle key={index} cx={seat.x} cy={seat.y} r={4.2} fill={color(seat.group)} opacity={selected && selected !== seat.group ? 0.2 : 1} />)}
    </Svg><Label secondary>{active.length} عضواً نشطاً</Label>
    {groups.map(([key, count]) => <View key={key} style={{ gap: 4 }}><NativeAction title={`${selected === key ? '✓ ' : ''}${groupLabel(key, dimension)} (${count})`} onPress={() => onSelect(key)} /><Label secondary style={{ fontSize: 12 }}>النسبة: {active.length ? (100 * count / active.length).toFixed(1) : 0}%</Label></View>)}
  </Section>;
}
// PORT STATUS: source resources/js/Pages/House/ParliamentChart2026.tsx; confidence medium; todos 0.
