import { Check, ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DirectoryDetailModal } from '@/components/directory';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { normalizeHouseSearch } from './model';

const ALL_DISTRICTS = 'all';
const ALL_LABEL = 'الكل';

interface DistrictPickerProps {
  districts: readonly string[];
  label: string;
  onChange: (district: string) => void;
  value: string;
}

// The source renders a select, and 47 districts are unreachable as a chip
// strip, so the native control opens a searchable list instead of scrolling.
export function DistrictPicker({
  districts,
  label,
  onChange,
  value,
}: DistrictPickerProps) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const term = normalizeHouseSearch(search);
  const options = useMemo(
    () =>
      [
        { label: ALL_LABEL, value: ALL_DISTRICTS },
        ...districts.map((district) => ({
          label: district,
          value: district,
        })),
      ].filter(
        (option) => !term || normalizeHouseSearch(option.label).includes(term),
      ),
    [districts, term],
  );
  const selectedLabel = value === ALL_DISTRICTS ? ALL_LABEL : value;

  const select = (district: string) => {
    onChange(district);
    setSearch('');
    setOpen(false);
  };

  return (
    <View style={styles.group}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
      <Pressable
        accessibilityLabel={`${label}: ${selectedLabel}`}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.palette.surfaceRaised,
            borderColor: theme.palette.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        testID="house-district-picker"
      >
        <AppText>{selectedLabel}</AppText>
        <ChevronDown color={theme.palette.mutedForeground} size={18} />
      </Pressable>

      <DirectoryDetailModal
        onClose={() => setOpen(false)}
        title={label}
        visible={open}
      >
        <AppInput
          accessibilityLabel="البحث في الدوائر الانتخابية"
          onChangeText={setSearch}
          placeholder="ابحث عن دائرة"
          testID="house-district-search"
          value={search}
        />
        {options.length === 0 ? (
          <AppText color="muted">لا توجد دائرة مطابقة</AppText>
        ) : (
          <View style={styles.optionList}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => select(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected
                        ? theme.palette.surfaceRaised
                        : 'transparent',
                      borderColor: selected
                        ? theme.palette.primary
                        : theme.palette.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                  testID={`house-district-option-${option.value}`}
                >
                  <AppText style={styles.optionLabel}>{option.label}</AppText>
                  {selected ? (
                    <Check color={theme.palette.primary} size={18} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </DirectoryDetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 6,
  },
  option: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionLabel: {
    flex: 1,
  },
  optionList: {
    gap: 8,
  },
  trigger: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/House/HouseClient.tsx (533 lines)
  confidence: high
  todos:      0
  notes:      Replaces the source district select with a searchable native list that keeps every district reachable.
*/
