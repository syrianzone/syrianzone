import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';

import type {
  EnvironmentalCityData,
  EnvironmentalReport,
  RainfallYear,
} from '../types';

function formatNumber(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  return typeof value === 'number'
    ? value.toLocaleString('en-US', {
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
      })
    : 'غير متوفر';
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText color="muted" variant="caption">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

function TextList({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.listRow}>
          <AppText color="primary">•</AppText>
          <AppText color="muted" style={styles.listCopy}>{item}</AppText>
        </View>
      ))}
    </View>
  );
}

export function RainfallDetails({
  name,
  years,
}: {
  name: string;
  years: readonly RainfallYear[];
}) {
  return (
    <AppCard testID="population-rainfall-details">
      <AppText variant="heading">{name}</AppText>
      <AppText color="muted">تفاصيل الهطولات المطرية السنوية</AppText>
      <View style={styles.sectionGap}>
        {[...years]
          .sort((first, second) => second.year - first.year)
          .map((item, index) => (
            <View key={`${item.year}-${index}`} style={styles.rainfallRow}>
              <View>
                <AppText color="muted" variant="caption">السنة</AppText>
                <AppText variant="heading">{item.year}</AppText>
              </View>
              <View style={styles.rainfallValues}>
                <Metric
                  label="الهطول"
                  value={`${formatNumber(item.rainfall, 1)} ملم`}
                />
                <Metric
                  label="المتوسط التاريخي"
                  value={`${formatNumber(item.rainfall_avg, 1)} ملم`}
                />
              </View>
            </View>
          ))}
      </View>
    </AppCard>
  );
}

export function CountryEnvironmentSummary({
  report,
}: {
  report: EnvironmentalReport;
}) {
  const context = report.country_level.climate_context;
  return (
    <View style={styles.cards} testID="population-environment-country">
      <AppCard>
        <AppText variant="heading">البيانات البيئية لسوريا</AppText>
        <AppText color="muted">اختر محافظة من الخريطة لعرض التفاصيل.</AppText>
        <Metric
          label="المدن المحللة"
          value={formatNumber(report.summary.total_cities_analyzed)}
        />
      </AppCard>
      <AppCard>
        <AppText variant="label">النتائج الرئيسية</AppText>
        <TextList items={report.summary.key_findings} />
      </AppCard>
      <AppCard>
        <AppText variant="label">التحديات المناخية</AppText>
        <TextList items={context.main_climate_challenges} />
      </AppCard>
      <AppCard>
        <AppText variant="label">الأحواض المائية الرئيسية</AppText>
        <TextList items={context.key_water_basins} />
      </AppCard>
      <AppCard>
        <AppText variant="label">التوصيات</AppText>
        <TextList items={report.summary.recommendations} />
      </AppCard>
      <AppCard>
        <Metric label="التصنيف المناخي" value={context.classification} />
        <AppText color="muted" variant="caption">
          المصادر: {report.metadata.data_sources.join('، ')}
        </AppText>
      </AppCard>
    </View>
  );
}

export function EnvironmentDetails({
  city,
  name,
  report,
}: {
  city: EnvironmentalCityData;
  name: string;
  report: EnvironmentalReport;
}) {
  const conditions = city.current_conditions;
  const forecast = city.daily_forecast_summary;
  const air = city.air_quality;
  const drought = city.drought_risk;
  const climate = city.climate_trends;
  const history = city.historical_summary;

  return (
    <View style={styles.cards} testID="population-environment-details">
      <AppCard>
        <AppText variant="heading">{name}</AppText>
        <AppText color="muted" variant="caption">
          {formatNumber(city.coordinates.latitude, 2)}°N، {formatNumber(city.coordinates.longitude, 2)}°E
        </AppText>
        <AppText variant="title">
          {formatNumber(conditions.temperature_celsius, 1)}°C
        </AppText>
        <AppText color="muted">
          المحسوسة {formatNumber(conditions.feels_like_celsius, 1)}°C
        </AppText>
        {conditions.weather_description ? (
          <AppText>{conditions.weather_description}</AppText>
        ) : null}
        {typeof city.population === 'number' ? (
          <Metric label="السكان" value={formatNumber(city.population)} />
        ) : null}
      </AppCard>

      <AppCard>
        <AppText variant="label">توقعات الغد</AppText>
        <View style={styles.metricGrid}>
          <Metric
            label="العظمى"
            value={`${formatNumber(forecast.tomorrow_max_temp_c, 1)}°C`}
          />
          <Metric
            label="الصغرى"
            value={`${formatNumber(forecast.tomorrow_min_temp_c, 1)}°C`}
          />
          <Metric
            label="الهطول المتوقع"
            value={`${formatNumber(forecast.tomorrow_precipitation_mm, 1)} ملم`}
          />
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">الحالة الجوية</AppText>
        <View style={styles.metricGrid}>
          <Metric
            label="الرطوبة"
            value={`${formatNumber(conditions.humidity_percent)}%`}
          />
          <Metric
            label="الرياح"
            value={`${formatNumber(conditions.wind_speed_kmh, 1)} كم/س`}
          />
          <Metric
            label="اتجاه الرياح"
            value={`${formatNumber(conditions.wind_direction_degrees)}°`}
          />
          <Metric
            label="الضغط الجوي"
            value={`${formatNumber(conditions.pressure_msl_hpa, 1)} hPa`}
          />
          <Metric
            label="الغطاء السحابي"
            value={`${formatNumber(conditions.cloud_cover_percent)}%`}
          />
          <Metric
            label="الهطول الحالي"
            value={`${formatNumber(conditions.precipitation_mm, 1)} ملم`}
          />
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">جودة الهواء</AppText>
        <View style={styles.metricGrid}>
          <Metric label="مؤشر AQI" value={formatNumber(air.estimated_aqi)} />
          <Metric label="التصنيف" value={air.category ?? 'غير متوفر'} />
        </View>
        {air.health_recommendation ? (
          <AppText color="muted">{air.health_recommendation}</AppText>
        ) : null}
        {air.estimated ? (
          <AppText color="muted" variant="caption">
            المؤشر تقديري اعتماداً على حالة الطقس.
          </AppText>
        ) : null}
      </AppCard>

      <AppCard>
        <AppText variant="label">مخاطر الجفاف</AppText>
        <View style={styles.metricGrid}>
          <Metric label="مستوى الخطر" value={drought.drought_risk ?? 'غير متوفر'} />
          <Metric label="التصنيف" value={drought.classification ?? 'غير متوفر'} />
          <Metric
            label="الهطول السنوي"
            value={`${formatNumber(drought.annual_precipitation_mm, 1)} ملم`}
          />
          <Metric
            label="أشهر الجفاف"
            value={formatNumber(drought.dry_season_months?.length)}
          />
          <Metric
            label="الأشهر الرطبة"
            value={formatNumber(drought.wet_season_months?.length)}
          />
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">اتجاهات المناخ</AppText>
        <View style={styles.metricGrid}>
          <Metric
            label="انحراف الحرارة"
            value={`${formatNumber(climate.temperature_trend_celsius, 2)}°C`}
          />
          <Metric
            label="معدل التغير السنوي"
            value={`${formatNumber(climate.temperature_change_rate_per_year, 3)}°C/سنة`}
          />
          <Metric
            label="تغير الهطول"
            value={`${formatNumber(climate.rainfall_trend_mm, 1)} ملم`}
          />
          <Metric
            label="متوسط الهطول السنوي"
            value={`${formatNumber(climate.average_annual_rainfall_mm, 1)} ملم`}
          />
          <Metric
            label="متوسط الضغط السطحي"
            value={`${formatNumber(climate.avg_surface_pressure_hpa, 1)} hPa`}
          />
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">الملخص التاريخي</AppText>
        <AppText color="muted" variant="caption">
          الفترة: {history.period_start ?? 'غير متوفر'} إلى {history.period_end ?? 'غير متوفر'}
        </AppText>
        <View style={styles.metricGrid}>
          <Metric
            label="متوسط الحرارة"
            value={`${formatNumber(history.avg_min_temp_c, 1)}° إلى ${formatNumber(history.avg_max_temp_c, 1)}°`}
          />
          <Metric
            label="إجمالي الهطول"
            value={`${formatNumber(history.total_precipitation_mm, 1)} ملم`}
          />
          <Metric
            label="أعلى سرعة رياح"
            value={`${formatNumber(history.max_wind_speed_kmh, 1)} كم/س`}
          />
          <Metric
            label="متوسط الضغط السطحي"
            value={`${formatNumber(history.avg_surface_pressure_hpa, 1)} hPa`}
          />
        </View>
        <AppText color="muted" variant="caption">
          المصادر: {report.metadata.data_sources.join('، ')}
        </AppText>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: 12 },
  list: { gap: 8 },
  listCopy: { flex: 1 },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  metric: { flexGrow: 1, gap: 2, minWidth: 112 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rainfallRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  rainfallValues: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionGap: { gap: 12, marginTop: 12 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Population/PopulationClient.tsx (996 lines)
  confidence: high
  todos:      0
  notes:      Native cards expose rainfall, weather, AQI, drought, climate trends, history, and national context.
*/
