import { CloudSun } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import { GOVERNORATES } from '../../_lib/governorates';
import type { WidgetProps } from '../../_lib/types';
import { weatherWidget, type WeatherConfig } from './index';

const WEATHER_AR: Record<string, string> = {
  'clear sky': 'سماء صافية',
  'few clouds': 'غيوم قليلة',
  'scattered clouds': 'غيوم متفرقة',
  'broken clouds': 'غيوم متقطعة',
  'overcast clouds': 'غائم',
  'light rain': 'مطر خفيف',
  'moderate rain': 'مطر معتدل',
  'heavy intensity rain': 'مطر غزير',
  'shower rain': 'زخات مطر',
  'rain': 'مطر',
  'thunderstorm': 'عاصفة رعدية',
  'snow': 'ثلج',
  'mist': 'ضباب',
  'haze': 'ضباب خفيف',
  'fog': 'ضباب كثيف',
  'dust': 'غبار',
  'sand': 'عواصف رملية',
};

export default function WeatherView({ config }: WidgetProps<WeatherConfig>) {
  const governorate = config.governorate ?? 'damascus';
  const query = useWidgetQuery(weatherWidget, governorate, () => sources.weather(governorate));
  const description = query.data ? (WEATHER_AR[query.data.description] ?? query.data.description) : '';

  return (
    <WidgetShell
      title={`الطقس · ${GOVERNORATES[governorate]?.label ?? ''}`}
      icon={CloudSun}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل الطقس' : null}
      onRetry={() => query.refetch()}
    >
      <div className="flex h-full flex-col items-center justify-center gap-1 p-3">
        <p dir="ltr" className="text-3xl font-semibold tabular-nums text-foreground">
          {query.data?.temp}°
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </WidgetShell>
  );
}
