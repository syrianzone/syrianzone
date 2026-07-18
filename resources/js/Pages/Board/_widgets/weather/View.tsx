import { CloudSun } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { GOVERNORATES, coordsOf } from '../../_lib/governorates';
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

interface WeatherPayload {
  main: { temp: number };
  weather: { description: string; icon: string }[];
}

// Cross-origin call to a Cloudflare Worker, so plain fetch rather than the app's
// axios instance. If the worker dies this must degrade to an error tile, never
// take the board down.
async function fetchWeather(lat: number, lon: number): Promise<{ temp: number; description: string }> {
  const res = await fetch(`https://syrianzone.hade-alahmad1.workers.dev/?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error('weather');
  const data = (await res.json()) as WeatherPayload;
  const raw = data.weather[0]?.description ?? '';
  return { temp: Math.round(data.main.temp), description: WEATHER_AR[raw] ?? raw };
}

export default function WeatherView({ config }: WidgetProps<WeatherConfig>) {
  const governorate = config.governorate ?? 'damascus';
  const { lat, lon } = coordsOf(governorate);
  const query = useWidgetQuery(weatherWidget, governorate, () => fetchWeather(lat, lon));

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
        <p className="text-xs text-muted-foreground">{query.data?.description}</p>
      </div>
    </WidgetShell>
  );
}
