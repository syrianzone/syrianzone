import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { GuideFilter } from '../_lib/types';

export function GuideFilterChip({
  guide,
  onClear,
}: {
  guide: GuideFilter;
  onClear: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.primary,
        },
      ]}
    >
      <AppText variant="caption">مساهمات {guide.name || 'مرشد'}</AppText>
      <Pressable
        accessibilityLabel="إلغاء التصفية"
        accessibilityRole="button"
        onPress={onClear}
        style={styles.clear}
      >
        <X color={theme.palette.foreground} size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clear: { padding: 3 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/Index.tsx (372 lines)
  confidence: high
  todos:      0
  notes:      This native extraction preserves the active-guide contribution label and clear action.
*/
