import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { CATEGORIES } from '../_lib/categories';
import type { PlaceCategory } from '../_lib/types';

export function FilterBar({ category, onCategory, onSearch, search }: { category: PlaceCategory | null; onCategory: (value: PlaceCategory | null) => void; onSearch: (value: string) => void; search: string }) {
  const { theme } = useAppTheme();
  return <View style={styles.root}><TextInput onChangeText={onSearch} placeholder="ابحث عن مكان" placeholderTextColor={theme.palette.mutedForeground} style={[styles.input, { borderColor: theme.palette.border, color: theme.palette.foreground }]} value={search} /><View style={styles.wrap}><Pressable onPress={() => onCategory(null)}><AppText variant="caption">الكل</AppText></Pressable>{CATEGORIES.map((item) => <Pressable key={item.key} onPress={() => onCategory(item.key)}><AppText color={category === item.key ? 'default' : 'muted'} variant="caption">{item.label}</AppText></Pressable>)}</View></View>;
}
const styles = StyleSheet.create({ input: { borderRadius: 12, borderWidth: 1, padding: 12, textAlign: 'right' }, root: { gap: 10 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } });
/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/FilterBar.tsx (49 lines)
  confidence: high
  todos:      0
  notes:      Search and category filters use native inputs and accessible press targets.
*/
