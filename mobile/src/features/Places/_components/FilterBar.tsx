import { MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { CATEGORIES, CATEGORY_LABELS } from '../_lib/categories';
import type {
  GeoSuggestion,
  LatLng,
  PlaceCategory,
  PlaceListItem,
} from '../_lib/types';

export function FilterBar({
  category,
  coordCandidate,
  geoResults,
  onCategoryChange,
  onGoToCoord,
  onQueryChange,
  onSelectGeo,
  onSelectResult,
  query,
  results,
  resultsLoading,
}: {
  category: PlaceCategory | null;
  coordCandidate: LatLng | null;
  geoResults: readonly GeoSuggestion[];
  onCategoryChange: (value: PlaceCategory | null) => void;
  onGoToCoord: (point: LatLng) => void;
  onQueryChange: (value: string) => void;
  onSelectGeo: (suggestion: GeoSuggestion) => void;
  onSelectResult: (place: PlaceListItem) => void;
  query: string;
  results: readonly PlaceListItem[];
  resultsLoading: boolean;
}) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const hasQuery = query.trim().length > 0;
  const activateFirst = () => {
    if (coordCandidate) {
      onGoToCoord(coordCandidate);
    } else if (results[0]) {
      onSelectResult(results[0]);
    } else if (geoResults[0]) {
      onSelectGeo(geoResults[0]);
    }
    setOpen(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.search, { borderColor: theme.palette.border }]}>
        <Search color={theme.palette.mutedForeground} size={18} />
        <TextInput
          accessibilityLabel="البحث عن مكان أو إحداثيات"
          onChangeText={(value) => {
            onQueryChange(value);
            setOpen(value.trim().length > 0);
          }}
          onFocus={() => setOpen(hasQuery)}
          onSubmitEditing={activateFirst}
          placeholder="ابحث عن مكان أو إحداثيات"
          placeholderTextColor={theme.palette.mutedForeground}
          returnKeyType="search"
          style={[styles.input, { color: theme.palette.foreground }]}
          value={query}
        />
      </View>
      {open && hasQuery ? (
        <AppCard style={styles.results}>
          {coordCandidate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onGoToCoord(coordCandidate);
                setOpen(false);
              }}
              style={styles.result}
            >
              <MapPin color={theme.palette.mutedForeground} size={18} />
              <View style={styles.resultCopy}>
                <AppText variant="label">الانتقال إلى النقطة</AppText>
                <AppText color="muted" variant="caption">
                  {coordCandidate.lat}, {coordCandidate.lng}
                </AppText>
              </View>
            </Pressable>
          ) : resultsLoading ? (
            <AppText color="muted">جارٍ البحث...</AppText>
          ) : results.length === 0 && geoResults.length === 0 ? (
            <AppText color="muted">لا توجد نتائج</AppText>
          ) : (
            <>
              {results.map((place) => (
                <Pressable
                  accessibilityRole="button"
                  key={place.id}
                  onPress={() => {
                    onSelectResult(place);
                    setOpen(false);
                  }}
                  style={styles.result}
                >
                  <View style={styles.resultCopy}>
                    <AppText numberOfLines={1} variant="label">{place.name}</AppText>
                    <AppText color="muted" variant="caption">{CATEGORY_LABELS[place.category]}</AppText>
                  </View>
                </Pressable>
              ))}
              {!coordCandidate ? geoResults.map((suggestion, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${suggestion.lat}:${suggestion.lng}:${index}`}
                  onPress={() => {
                    onSelectGeo(suggestion);
                    setOpen(false);
                  }}
                  style={styles.result}
                >
                  <MapPin color={theme.palette.mutedForeground} size={18} />
                  <View style={styles.resultCopy}>
                    <AppText numberOfLines={1} variant="label">{suggestion.name}</AppText>
                    <AppText color="muted" numberOfLines={1} variant="caption">{suggestion.address}</AppText>
                  </View>
                </Pressable>
              )) : null}
              {!coordCandidate && geoResults.length > 0 ? (
                <AppText color="muted" style={styles.attribution} variant="caption">
                  powered by Google
                </AppText>
              ) : null}
            </>
          )}
        </AppCard>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.categories}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Pressable
          onPress={() => onCategoryChange(null)}
          style={[
            styles.category,
            {
              backgroundColor: category === null ? theme.palette.primary : theme.palette.surface,
              borderColor: theme.palette.border,
            },
          ]}
        >
          <AppText style={category === null ? { color: theme.palette.primaryForeground } : undefined} variant="caption">الكل</AppText>
        </Pressable>
        {CATEGORIES.map((item) => {
          const active = category === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onCategoryChange(active ? null : item.key)}
              style={[
                styles.category,
                {
                  backgroundColor: active ? theme.palette.primary : theme.palette.surface,
                  borderColor: theme.palette.border,
                },
              ]}
            >
              <AppText style={active ? { color: theme.palette.primaryForeground } : undefined} variant="caption">{item.label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  attribution: { textAlign: 'left' },
  categories: { flexDirection: 'row-reverse', gap: 7 },
  category: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  input: { flex: 1, minHeight: 46, textAlign: 'right' },
  result: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8, minHeight: 44 },
  resultCopy: { flex: 1, gap: 2 },
  results: { gap: 8, padding: 10 },
  root: { gap: 8 },
  search: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/FilterBar.tsx (256 lines)
  confidence: high
  todos:      0
  notes:      Native coordinate parsing, local and Google results, attribution, submit selection, and category toggles preserve search behavior.
*/
