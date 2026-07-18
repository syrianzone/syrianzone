import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ExternalLink, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { fetchHouseData, houseQueryKeys } from './data';
import { HouseCharts } from './HouseCharts';
import {
  DEFAULT_HOUSE_FILTERS,
  DEFAULT_HOUSE_SORT,
  deriveHouseDistricts,
  deriveHouseStats,
  displayHouseColumns,
  extractNewNames,
  filterHouseRows,
  housePercentage,
  isHouseWinner,
  nextHouseSort,
  paginateHouseRows,
  sortHouseRows,
  type AgeFilter,
  type AppealFilter,
  type HouseFilters,
  type ResultFilter,
  type SexFilter,
} from './model';
import {
  HOUSE_MODES,
  PROVINCES,
  type HouseRow,
  type Mode,
  type ProvinceKey,
} from './types';

const EMPTY_HEADERS: string[] = [];
const EMPTY_ROWS: HouseRow[] = [];
const PAGE_SIZE = 40;
const SOURCE_URL = 'https://hcepa.gov.sy';

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  candidates: 'المرشحون لانتخابات المجلس التشريعي، مع البحث والتصفية',
  presidential:
    'الثلث الرئاسي: الأعضاء المعينون، مع البحث والإحصاءات',
  voters: 'أعضاء الهيئات الناخبة، مع البحث والتصفية والإحصاءات',
  winners: 'الفائزون في انتخابات المجلس التشريعي',
};

interface ChoiceOption {
  id: string;
  label: string;
  testID?: string;
}

interface ChoiceGroupProps {
  label: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  value: string;
}

function ChoiceGroup({ label, onChange, options, value }: ChoiceGroupProps) {
  const { direction } = useLocale();
  const { theme } = useAppTheme();

  return (
    <View style={styles.choiceGroup}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
      <ScrollView
        contentContainerStyle={[
          styles.choiceRow,
          { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected
                    ? theme.palette.primary
                    : theme.palette.surfaceRaised,
                  borderColor: selected
                    ? theme.palette.primary
                    : theme.palette.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              testID={option.testID}
            >
              <AppText
                style={{
                  color: selected
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground,
                }}
                variant="caption"
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface StatCardProps {
  color?: 'danger' | 'default' | 'primary';
  label: string;
  percent?: string;
  value: number;
}

function StatCard({ color = 'default', label, percent, value }: StatCardProps) {
  return (
    <AppCard style={styles.statCard}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
      <AppText color={color} variant="heading">
        {value}
      </AppText>
      {percent ? (
        <AppText color="muted" variant="caption">
          {percent}
        </AppText>
      ) : null}
    </AppCard>
  );
}

const SEX_OPTIONS: readonly ChoiceOption[] = [
  { id: '', label: 'الكل', testID: 'house-sex-all' },
  { id: 'ذكر', label: 'ذكر', testID: 'house-sex-male' },
  { id: 'أنثى', label: 'أنثى', testID: 'house-sex-female' },
];

const AGE_OPTIONS: readonly ChoiceOption[] = [
  { id: '', label: 'الكل' },
  { id: 'lt30', label: 'أقل من 30' },
  { id: '30s', label: '30-39' },
  { id: '40s', label: '40-49' },
  { id: '50s', label: '50-59' },
  { id: '60p', label: '+60' },
];

const APPEAL_OPTIONS: readonly ChoiceOption[] = [
  { id: '', label: 'الكل', testID: 'house-appeal-all' },
  { id: 'appealed', label: 'مطعون', testID: 'house-appeal-appealed' },
  { id: 'notAppealed', label: 'سليم', testID: 'house-appeal-clean' },
];

const RESULT_OPTIONS: readonly ChoiceOption[] = [
  { id: '', label: 'الكل' },
  { id: 'winner', label: 'فائز' },
  { id: 'notWinner', label: 'غير فائز' },
];

export default function HouseClient() {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  const [mode, setMode] = useState<Mode>('voters');
  const [province, setProvince] = useState<ProvinceKey>('damascus');
  const [filters, setFilters] = useState<HouseFilters>({
    ...DEFAULT_HOUSE_FILTERS,
  });
  const [sort, setSort] = useState(DEFAULT_HOUSE_SORT);
  const [page, setPage] = useState(0);

  const query = useQuery({
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchHouseData({ mode, province, signal }),
    queryKey: houseQueryKeys.detail(mode, province),
    staleTime: 60 * 60 * 1000,
  });

  const rows = query.data?.rows ?? EMPTY_ROWS;
  const headers = query.data?.headers ?? EMPTY_HEADERS;
  const districts = useMemo(
    () => deriveHouseDistricts(rows, mode),
    [mode, rows],
  );
  const filteredRows = useMemo(
    () => filterHouseRows(rows, mode, filters),
    [filters, mode, rows],
  );
  const sortedRows = useMemo(
    () => sortHouseRows(filteredRows, sort),
    [filteredRows, sort],
  );
  const columns = useMemo(
    () => displayHouseColumns(headers, filteredRows),
    [filteredRows, headers],
  );
  const stats = useMemo(() => deriveHouseStats(filteredRows), [filteredRows]);
  const newNames = useMemo(
    () => extractNewNames(headers, filteredRows, mode),
    [filteredRows, headers, mode],
  );
  const pageData = paginateHouseRows(sortedRows, page, PAGE_SIZE);

  const updateFilter = <Key extends keyof HouseFilters>(
    key: Key,
    value: HouseFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };

  const changeMode = (nextMode: string) => {
    setMode(nextMode as Mode);
    setPage(0);
  };

  const resetFilters = () => {
    setFilters({ ...DEFAULT_HOUSE_FILTERS });
    if (mode === 'voters') {
      setProvince('damascus');
    }
    setPage(0);
  };

  const showStats =
    mode === 'voters' || mode === 'winners' || mode === 'presidential';
  const showingCachedData =
    Boolean(query.data) &&
    (query.isError || query.fetchStatus === 'paused');

  return (
    <Screen
      contentStyle={{ direction }}
      onRefresh={() => void query.refetch()}
      refreshing={query.isFetching}
      subtitle={MODE_DESCRIPTIONS[mode]}
      title="المجلس التشريعي"
    >
      <ChoiceGroup
        label="نوع القائمة"
        onChange={changeMode}
        options={HOUSE_MODES.map((item) => ({
          id: item.id,
          label: item.label,
          testID: `house-mode-${item.id}`,
        }))}
        value={mode}
      />

      <AppCard style={styles.attributionCard}>
        <AppText variant="caption">
          هذه مبادرة فردية غير حكومية. البيانات مجمعة من الموقع الرسمي.
        </AppText>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(SOURCE_URL).catch(() => undefined)}
          style={styles.sourceLink}
        >
          <ExternalLink color={theme.palette.primary} size={16} />
          <AppText color="primary" variant="label">
            المصدر: اللجنة العليا للانتخابات
          </AppText>
        </Pressable>
        <AppText color="muted" variant="caption">
          تمر البيانات عبر خادم syrian.zone وتُحفظ مؤقتًا لمدة ساعة.
        </AppText>
      </AppCard>

      <AppCard style={styles.controls}>
        {mode === 'voters' ? (
          <ChoiceGroup
            label="المحافظة"
            onChange={(value) => {
              setProvince(value as ProvinceKey);
              setPage(0);
            }}
            options={PROVINCES.map((item) => ({
              id: item.key,
              label: item.label,
            }))}
            value={province}
          />
        ) : null}

        {mode === 'winners' ? (
          <ChoiceGroup
            label="الدائرة الانتخابية"
            onChange={(value) => updateFilter('district', value)}
            options={[
              { id: 'all', label: 'الكل' },
              ...districts.map((district) => ({
                id: district,
                label: district,
              })),
            ]}
            value={filters.district}
          />
        ) : null}

        <View style={styles.inputGroup}>
          <AppText color="muted" variant="caption">
            بحث
          </AppText>
          <TextInput
            onChangeText={(value) => updateFilter('search', value)}
            placeholder="ابحث بالاسم أو المكان"
            placeholderTextColor={theme.palette.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: theme.palette.surfaceRaised,
                borderColor: theme.palette.border,
                color: theme.palette.foreground,
              },
            ]}
            testID="house-search"
            value={filters.search}
          />
        </View>

        <ChoiceGroup
          label="الجنس"
          onChange={(value) => updateFilter('sex', value as SexFilter)}
          options={SEX_OPTIONS}
          value={filters.sex}
        />
        <ChoiceGroup
          label="العمر"
          onChange={(value) => updateFilter('age', value as AgeFilter)}
          options={AGE_OPTIONS}
          value={filters.age}
        />

        {mode === 'voters' ? (
          <ChoiceGroup
            label="حالة الطعن"
            onChange={(value) =>
              updateFilter('appeal', value as AppealFilter)
            }
            options={APPEAL_OPTIONS}
            value={filters.appeal}
          />
        ) : null}

        {mode === 'candidates' ? (
          <ChoiceGroup
            label="النتيجة"
            onChange={(value) =>
              updateFilter('result', value as ResultFilter)
            }
            options={RESULT_OPTIONS}
            value={filters.result}
          />
        ) : null}

        <AppButton
          icon={<RotateCcw color={theme.palette.foreground} size={18} />}
          onPress={resetFilters}
          variant="secondary"
        >
          إعادة ضبط الفلاتر
        </AppButton>
      </AppCard>

      {query.isPending ? (
        <AppCard style={styles.loadingCard}>
          <ActivityIndicator color={theme.palette.primary} />
          <AppText color="muted">جاري تحميل بيانات المجلس...</AppText>
        </AppCard>
      ) : null}

      {query.isError && !query.data ? (
        <QueryState
          detail="تعذر تحميل بيانات المجلس. حاول مرة أخرى عند توفر الاتصال."
          onRetry={() => void query.refetch()}
          type="error"
        />
      ) : null}

      {showingCachedData ? (
        <AppCard style={styles.statusCard}>
          <AppText color="danger" variant="caption">
            يتم عرض آخر بيانات المجلس المحفوظة لأن التحديث تعذر.
          </AppText>
        </AppCard>
      ) : null}

      {query.isPlaceholderData ? (
        <AppCard style={styles.statusCard}>
          <ActivityIndicator color={theme.palette.primary} size="small" />
          <AppText color="muted" variant="caption">
            يتم عرض البيانات السابقة حتى يكتمل التحديث.
          </AppText>
        </AppCard>
      ) : null}

      {showStats && query.data ? (
        <View style={styles.statsGrid}>
          <StatCard color="primary" label="الإجمالي" value={stats.total} />
          <StatCard
            label="ذكور"
            percent={housePercentage(stats.male, stats.total)}
            value={stats.male}
          />
          <StatCard
            label="إناث"
            percent={housePercentage(stats.female, stats.total)}
            value={stats.female}
          />
          {mode === 'voters' ? (
            <StatCard
              color="danger"
              label="مطعونين"
              percent={housePercentage(stats.appealed, stats.total)}
              value={stats.appealed}
            />
          ) : null}
        </View>
      ) : null}

      {showStats && query.data ? (
        <HouseCharts sexFilter={filters.sex} stats={stats} />
      ) : null}

      {newNames.length > 0 ? (
        <AppCard style={styles.newNamesCard}>
          <AppText color="primary" variant="heading">
            أسماء جديدة
          </AppText>
          <AppText color="muted" variant="caption">
            وردت في القوائم النهائية ولم تظهر في القوائم الأولية ({newNames.length})
          </AppText>
          <View style={styles.nameList}>
            {newNames.map((name, index) => (
              <View
                key={`${name}-${index}`}
                style={[
                  styles.nameItem,
                  {
                    backgroundColor: theme.palette.surfaceRaised,
                    borderColor: theme.palette.border,
                  },
                ]}
              >
                <AppText>{name}</AppText>
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      {query.data && sortedRows.length === 0 ? (
        <QueryState detail="لا توجد بيانات مطابقة" type="empty" />
      ) : null}

      {sortedRows.length > 0 ? (
        <View style={styles.recordsSection}>
          <View style={styles.recordsHeading}>
            <View style={styles.recordsCopy}>
              <AppText variant="heading">القائمة الرئيسية</AppText>
              <AppText color="muted" variant="caption">
                السجلات {pageData.start + 1} إلى {pageData.end} من{' '}
                {sortedRows.length}
              </AppText>
            </View>
            {query.isFetching && !query.isPlaceholderData ? (
              <ActivityIndicator color={theme.palette.primary} size="small" />
            ) : null}
          </View>

          <ChoiceGroup
            label="الترتيب"
            onChange={(column) => {
              setSort((current) => nextHouseSort(current, column));
              setPage(0);
            }}
            options={columns.map((column) => ({
              id: column,
              label:
                sort.column === column
                  ? `${column} ${sort.direction === 'asc' ? '▲' : '▼'}`
                  : column,
              testID: `house-sort-${column}`,
            }))}
            value={sort.column}
          />

          {pageData.items.map((row, index) => {
            const appealed = row.__appealStatus === 'مطعون';
            const winner = isHouseWinner(row);
            const recordIndex = pageData.start + index;
            return (
              <AppCard
                key={`${row.__nameNorm}-${row.__placeNorm}-${recordIndex}`}
                style={[
                  styles.recordCard,
                  appealed ? { borderColor: theme.palette.danger } : null,
                  winner ? { borderColor: theme.palette.primary } : null,
                ]}
                testID={`house-row-${recordIndex}`}
              >
                <View style={styles.recordHeader}>
                  <AppText color="muted" variant="caption">
                    سجل {recordIndex + 1}
                  </AppText>
                  <View style={styles.badges}>
                    {appealed ? (
                      <AppText color="danger" variant="caption">
                        مطعون
                      </AppText>
                    ) : null}
                    {winner ? (
                      <AppText color="primary" variant="caption">
                        فائز
                      </AppText>
                    ) : null}
                  </View>
                </View>
                {columns.map((column) => (
                  <View
                    key={column}
                    style={[
                      styles.cell,
                      { borderBottomColor: theme.palette.border },
                    ]}
                  >
                    <AppText color="muted" variant="caption">
                      {column}
                    </AppText>
                    <AppText>{row[column]?.trim() || 'غير متوفر'}</AppText>
                  </View>
                ))}
              </AppCard>
            );
          })}

          {pageData.totalPages > 1 ? (
            <View style={styles.pagination}>
              <AppButton
                disabled={pageData.page === 0}
                onPress={() => setPage(pageData.page - 1)}
                variant="secondary"
              >
                السابق
              </AppButton>
              <AppText color="muted" variant="caption">
                الصفحة {pageData.page + 1} من {pageData.totalPages}
              </AppText>
              <AppButton
                disabled={pageData.page === pageData.totalPages - 1}
                onPress={() => setPage(pageData.page + 1)}
                variant="secondary"
              >
                التالي
              </AppButton>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  attributionCard: {
    borderLeftColor: '#d97706',
    borderLeftWidth: 4,
    gap: 8,
  },
  badges: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  cell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingBottom: 9,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  choiceGroup: {
    gap: 6,
  },
  choiceRow: {
    gap: 8,
    paddingVertical: 2,
  },
  controls: {
    gap: 16,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: 'IBMPlexSansArabic_400Regular',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputGroup: {
    gap: 6,
  },
  loadingCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
  },
  nameItem: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nameList: {
    gap: 8,
  },
  newNamesCard: {
    gap: 10,
  },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'center',
  },
  recordCard: {
    gap: 10,
  },
  recordHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  recordsCopy: {
    flex: 1,
    gap: 2,
  },
  recordsHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  recordsSection: {
    gap: 12,
  },
  sourceLink: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    gap: 7,
  },
  statCard: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 2,
    minWidth: 136,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/House/HouseClient.tsx (533 lines)
  confidence: high
  todos:      0
  notes:      Native controls, charts, dynamic records, loading states, and bounded paging preserve the source screen.
*/
