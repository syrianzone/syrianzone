import { LayoutGrid, Map as MapIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

export type PlacesView = 'grid' | 'map';

export function placesViewFromParam(
  value: string | string[] | undefined,
): PlacesView {
  const current = Array.isArray(value) ? value[0] : value;
  return current === 'grid' ? 'grid' : 'map';
}

export function ViewToggle({
  onChange,
  view,
}: {
  onChange: (view: PlacesView) => void;
  view: PlacesView;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.root, { borderColor: theme.palette.border }]}>
      {([
        ['map', 'خريطة', MapIcon],
        ['grid', 'معرض', LayoutGrid],
      ] as const).map(([value, label, Icon]) => {
        const active = value === view;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={value}
            onPress={() => onChange(value)}
            style={[styles.item, { backgroundColor: active ? theme.palette.primary : 'transparent' }]}
          >
            <Icon color={active ? theme.palette.primaryForeground : theme.palette.foreground} size={16} />
            <AppText style={active ? { color: theme.palette.primaryForeground } : undefined} variant="caption">{label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', borderRadius: 18, flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 13, paddingVertical: 8 },
  root: { alignSelf: 'center', borderRadius: 22, borderWidth: 1, flexDirection: 'row-reverse', gap: 3, padding: 3 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/ViewToggle.tsx (28 lines)
  confidence: high
  todos:      0
  notes:      Native map and gallery selection preserves the shared view switch.
*/
