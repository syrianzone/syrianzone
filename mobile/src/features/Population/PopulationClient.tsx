import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { loadBundledProvinceData } from '@/lib/geojson/bundled';

import {
  CountryEnvironmentSummary,
  EnvironmentDetails,
  RainfallDetails,
} from './components/AtlasDetails';
import { DemographicPanel } from './components/GovernorateComparison';
import MapClient from './components/map/MapClient';
import { ProvinceSummary } from './components/map/tooltip-generators';
import {
  DATA_TYPE_CONFIG,
  DATA_TYPE_ORDER,
  type DataType,
} from './constants/data-config';
import { fetchEnvironmentalReport, fetchPopulationMaster } from './lib/data-fetcher';
import {
  buildAtlasCollection,
  buildGovernorateComparison,
  comparisonGovernorates,
  type ComparisonDataType,
} from './model';
import type { DataSource, PopulationCollection, PopulationFeature } from './types';
import {
  featureDisplayName,
  findEnvironmentalData,
  findPopulation,
  findRainData,
} from './utils/data-finder';

function isComparisonType(type: DataType): type is ComparisonDataType {
  return type === 'population' || type === 'idp' || type === 'idp_returnees';
}

export default function PopulationClient() {
  const { theme } = useAppTheme();
  const [dataType, setDataType] = useState<DataType>('population');
  const [sourceIds, setSourceIds] = useState<Partial<Record<DataType, number>>>({});
  const [selected, setSelected] = useState<PopulationFeature | null>(null);
  const [compared, setCompared] = useState<readonly string[]>([]);
  const query = useQuery({
    queryKey: ['population-atlas'],
    queryFn: async ({ signal }) => {
      const [boundaries, master, environment] = await Promise.all([
        loadBundledProvinceData(),
        fetchPopulationMaster(signal),
        fetchEnvironmentalReport(signal),
      ]);
      return { boundaries, environment, master };
    },
  });

  const sources = query.data?.master.groups[dataType] ?? [];
  const requestedSourceId = sourceIds[dataType] ?? sources[0]?.source_id ?? null;
  const source = sources.find((item) => item.source_id === requestedSourceId) ?? sources[0] ?? null;
  const currentSourceId = source?.source_id ?? null;
  const config = DATA_TYPE_CONFIG[dataType];
  const mapData = useMemo<PopulationCollection | null>(() => {
    if (!query.data) {
      return null;
    }
    return buildAtlasCollection({
      boundaries: query.data.boundaries,
      dataType,
      environment: query.data.environment,
      master: query.data.master,
      source,
    });
  }, [dataType, query.data, source]);

  const comparison = useMemo(() => {
    if (!query.data) {
      return null;
    }
    const overrides: Partial<Record<ComparisonDataType, DataSource>> = {};
    if (isComparisonType(dataType) && source) {
      overrides[dataType] = source;
    }
    return buildGovernorateComparison(query.data.master.groups, compared, overrides);
  }, [compared, dataType, query.data, source]);

  const selectedName = selected ? featureDisplayName(selected, 'ar') : null;
  const selectedPopulation =
    selectedName && isComparisonType(dataType)
      ? findPopulation(selectedName, source?.cities ?? null)
      : null;
  const selectedRainfall =
    selected && query.data
      ? findRainData(selected, query.data.master.rainfall_data)
      : null;
  const selectedEnvironment =
    selected && query.data
      ? findEnvironmentalData(selected, query.data.environment)
      : null;

  const chooseType = (type: DataType) => {
    setDataType(type);
    setSelected(null);
    if (type === 'rainfall') {
      setCompared([]);
    }
  };

  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isFetching}
      subtitle="بيانات السكان والنزوح والمطر والمناخ"
      title="أطلس سوريا التفاعلي"
    >
      <View style={styles.tabs}>
        {DATA_TYPE_ORDER.map((type) => {
          const active = dataType === type;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={type}
              onPress={() => chooseType(type)}
              style={[
                styles.tab,
                {
                  backgroundColor: active
                    ? theme.palette.primary
                    : theme.palette.surface,
                  borderColor: theme.palette.border,
                },
              ]}
              testID={`population-tab-${type}`}
            >
              <AppText
                style={{
                  color: active
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground,
                }}
                variant="caption"
              >
                {DATA_TYPE_CONFIG[type].labelAr}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {query.isError ? (
        <QueryState
          detail="تعذر تحميل بيانات الأطلس. حاول مرة أخرى عند توفر الاتصال."
          onRetry={() => void query.refetch()}
          type="error"
        />
      ) : null}
      {query.isPending ? (
        <AppText color="muted">يتم تحميل بيانات المحافظات.</AppText>
      ) : null}
      {mapData ? <MapClient data={mapData} onSelect={setSelected} /> : null}

      {query.data && dataType === 'rainfall' ? (
        selectedName ? (
          selectedRainfall && selectedRainfall.length > 0 ? (
            <RainfallDetails name={selectedName} years={selectedRainfall} />
          ) : (
            <QueryState detail="لا توجد بيانات مطرية لهذه المحافظة." type="empty" />
          )
        ) : (
          <AppCard>
            <AppText variant="label">خريطة الأمطار</AppText>
            <AppText color="muted">اختر محافظة لعرض الهطول السنوي والمتوسط التاريخي.</AppText>
          </AppCard>
        )
      ) : null}

      {query.data && dataType === 'environmental' ? (
        selected ? (
          selectedName && selectedEnvironment ? (
            <EnvironmentDetails
              city={selectedEnvironment}
              name={selectedName}
              report={query.data.environment}
            />
          ) : (
            <QueryState detail="لا تتوفر بيانات بيئية لهذه المحافظة." type="empty" />
          )
        ) : (
          <CountryEnvironmentSummary report={query.data.environment} />
        )
      ) : null}

      {query.data && isComparisonType(dataType) ? (
        <>
          {selectedName && selectedPopulation !== null ? (
            <AppCard>
              <ProvinceSummary
                label={selectedName}
                value={`${config.label}: ${selectedPopulation.toLocaleString('en-US')}`}
              />
            </AppCard>
          ) : null}
          <DemographicPanel
            compared={compared}
            comparison={comparison}
            currentSourceId={currentSourceId}
            onClearComparison={() => setCompared([])}
            onSourceChange={(sourceId) =>
              setSourceIds((current) => ({ ...current, [dataType]: sourceId }))
            }
            onToggleProvince={(province) =>
              setCompared((current) => comparisonGovernorates(current, province))
            }
            source={source}
            sources={sources}
          />
        </>
      ) : null}

      <AppCard>
        <AppText variant="label">المفتاح</AppText>
        {config.legend.map((item) => (
          <View key={item.labelEn} style={styles.legend}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <AppText color="muted">{item.label}</AppText>
          </View>
        ))}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  swatch: { borderRadius: 4, height: 14, width: 14 },
  tab: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Population/PopulationClient.tsx (996 lines)
  confidence: high
  todos:      0
  notes:      Native atlas renders every data layer, source, province detail, climate report, and comparison flow.
*/
