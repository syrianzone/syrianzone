import { Clock, Moon, MoonStar, Sun, SunDim, Sunrise, Sunset } from 'lucide-react';

/** One icon per prayer, shared by Roznama, the prayer page and the board widget. */
export function PrayerIcon({ prayer, className }: { prayer: string; className?: string }) {
  switch (prayer) {
    case 'Fajr':
      return <MoonStar className={className} />;
    case 'Sunrise':
      return <Sunrise className={className} />;
    case 'Dhuhr':
      return <Sun className={className} />;
    case 'Asr':
      return <SunDim className={className} />;
    case 'Maghrib':
      return <Sunset className={className} />;
    case 'Isha':
      return <Moon className={className} />;
    default:
      return <Clock className={className} />;
  }
}
