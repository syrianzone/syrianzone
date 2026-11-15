import { View } from 'react-native';
import { Label } from '../components';
import { NativeSymbol } from './native';
import { useTheme } from './theme';
import { rankName } from '../platform/guide-rank';

export function GuideBadge({ level, label = true }: { level: number; label?: boolean }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!Number.isFinite(level) || level < 1) return null;
  const color = level >= 8 ? 'hsl(340,68%,58%)' : level >= 6 ? 'hsl(38,80%,50%)' : colors.accent;
  return <View accessible accessibilityRole="image" accessibilityLabel={`${rankName(level)}، المستوى ${level}`} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 18, backgroundColor: colors.elevated, borderWidth: level >= 3 ? 1 : 0, borderColor: color }}>
    {level >= 3 ? <NativeSymbol name="mappin" color={color} size={14} /> : null}
    {level >= 4 ? <View style={{ alignItems: 'center', justifyContent: 'center' }}><NativeSymbol name="star.fill" color={color} size={26} /><Label style={{ position: 'absolute', fontSize: 10, lineHeight: 14, color: level >= 6 && level < 8 ? 'hsl(38,90%,15%)' : '#FFFFFF', fontWeight: '700' }}>{level}</Label></View> : <Label style={{ color }}>{level}</Label>}
    {label ? <Label style={{ color, fontSize: 13 }}>{rankName(level)}</Label> : null}
  </View>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/LevelBadge.tsx; confidence medium; todos 1 native badge contrast and Dynamic Type verification.
