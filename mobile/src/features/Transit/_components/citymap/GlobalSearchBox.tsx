import { useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { useMapStore } from '../../_store/useMapStore';
import { searchTransit } from '../../api';

export function GlobalSearchBox({ cityId }: { cityId: string }) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const setSelectedRouteId = useMapStore((state) => state.setSelectedRouteId);
  const results = useQuery({
    enabled: deferred.length >= 2,
    queryFn: () => searchTransit(deferred, cityId),
    queryKey: ['transit-search', cityId, deferred],
    staleTime: 30_000,
  });
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
      {deferred.length >= 2 && results.data ? (
        <AppCard style={styles.results}>
          {results.data.slice(0, 8).map((result) => (
            <Pressable
              key={`${result.type}-${result.id}`}
              onPress={() => {
                if (result.type === 'route') {
                  setSelectedRouteId(result.id);
                }
                setQuery('');
              }}
              style={styles.result}
            >
              <MapPin color={theme.palette.primary} size={17} />
              <AppText style={styles.resultCopy}>{result.nameAr}</AppText>
              <AppText color="muted" variant="caption">
                {result.type === 'route' ? 'خط' : 'محطة'}
              </AppText>
            </Pressable>
          ))}
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
  notes:      Deferred native search preserves route and stop results without browser focus assumptions.
*/
