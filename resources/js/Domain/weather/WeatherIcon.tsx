import { Cloud, CloudLightning, CloudRain, Snowflake, Sun, Wind } from 'lucide-react';

/** OpenWeather icon code -> Lucide icon, in the colours Home and Roznama share. */
export function WeatherIcon({ code, className = 'w-8 h-8' }: { code: string; className?: string }) {
  if (code.startsWith('01')) return <Sun className={`${className} text-yellow-500`} />;
  if (code.startsWith('02')) return <Sun className={`${className} text-orange-400`} />;
  if (code.startsWith('03') || code.startsWith('04'))
    return <Cloud className={`${className} text-gray-400`} />;
  if (code.startsWith('09') || code.startsWith('10'))
    return <CloudRain className={`${className} text-blue-400`} />;
  if (code.startsWith('11')) return <CloudLightning className={`${className} text-purple-500`} />;
  if (code.startsWith('13')) return <Snowflake className={`${className} text-white`} />;
  if (code.startsWith('50')) return <Wind className={`${className} text-gray-300`} />;
  return <Sun className={`${className} text-yellow-500`} />;
}
