import { useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { useMapStore } from '../../_store/useMapStore';
import type { TransitSearchResult } from '../../_types';
import { searchTransit } from '../../api';

export function GlobalSearchBox({ cityId }: { cityId: string }) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const focusMap = useMapStore((state) => state.focusMap);
  const selectRoute = useMapStore((state) => state.selectRoute);
  const selectStop = useMapStore((state) => state.selectStop);
  const results = useQuery({
    enabled: deferred.length >= 2,
    queryFn: () => searchTransit(deferred, cityId),
    queryKey: ['transit-search', cityId, deferred],
    staleTime: 30_000,
  });
  const select = (result: TransitSearchResult) => {
    setQuery('');
    if (result.type === 'route') {
      selectRoute(result.id);
      return;
    }
    selectStop(result.id);
    if (result.coordinates) {
      focusMap(result.coordinates, 15);
    }
  };
  return (
    <View style={styles.root}>
      <View style={styles.inputRow}>
        <Search color={theme.palette.mutedForeground} size={19} />
        <AppInput
          onChangeText={setQuery}
          placeholder="ابحث عن خط أو محطة"
          style={styles.input}
          value={query}
        />
      </View>
      {deferred.length < 2 ? null : results.isLoading ? (
        <AppCard style={styles.results}>
          <ActivityIndicator
            color={theme.palette.primary}
            testID="transit-search-loading"
          />
        </AppCard>
      ) : results.isError ? (
        <AppCard style={styles.results}>
          <AppText color="danger" variant="caption">
            تعذر البحث، حاول مجدداً
          </AppText>
        </AppCard>
      ) : results.data ? (
        <AppCard style={styles.results}>
          {results.data.length === 0 ? (
            <AppText color="muted" variant="caption">
              لا توجد نتائج مطابقة
            </AppText>
          ) : (
            results.data.slice(0, 8).map((result) => (
              <Pressable
                key={`${result.type}-${result.id}`}
                onPress={() => select(result)}
                style={styles.result}
              >
                <MapPin color={theme.palette.primary} size={17} />
                <AppText style={styles.resultCopy}>{result.nameAr}</AppText>
                <AppText color="muted" variant="caption">
                  {result.type === 'route' ? 'خط' : 'محطة'}
                </AppText>
              </Pressable>
            ))
          )}
        </AppCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  result: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
  },
  resultCopy: {
    flex: 1,
  },
  results: {
    gap: 4,
  },
  root: {
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/GlobalSearchBox.tsx (141 lines)
  confidence: high
  todos:      0
  notes:      Deferred native search keeps loading and failure states, focuses a picked route, and flies to a picked stop.
*/
