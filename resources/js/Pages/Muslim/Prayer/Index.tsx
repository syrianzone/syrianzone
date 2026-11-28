import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import { MuslimIcon } from '@/Components/Icons/ProjectIcons';
import MuslimShell from '../_components/MuslimShell';
import PrayerView from '../_components/PrayerView';
import { useMuslimPrefs } from '../../../Domain/settings/prefs';
import type { PrayerHijri } from '../../../Domain/prayer/times';
import type { MonthlyPrayerCalendar, QiblaInfo, TodaySyriaInfo } from '../../../Domain/prayer/ramadan';

interface PrayerPageProps {
  initialCity?: string | null;
  initialCityName?: string | null;
  initialPrayer?: {
    governorate: string;
    method: number;
    timings: Record<string, string>;
    hijri: PrayerHijri | null;
  } | null;
  monthlyCalendar?: MonthlyPrayerCalendar | null;
  qibla?: QiblaInfo | null;
  todayInfo?: TodaySyriaInfo | null;
}

export default function Index({
  initialCity,
  initialCityName,
  initialPrayer,
  monthlyCalendar,
  qibla,
  todayInfo,
}: PrayerPageProps) {
  const { prefs, setPrefs, isLoggedIn } = useMuslimPrefs();

  return (
    <MainLayout>
      <MuslimShell
        title={initialCityName ? `مواقيت الصلاة في ${initialCityName}` : 'مواقيت الصلاة'}
        icon={MuslimIcon}
        width="default"
      >
        <PrayerView
          prefs={prefs}
          setPrefs={setPrefs}
          isLoggedIn={isLoggedIn}
          initialCity={initialCity ?? null}
          initialCityName={initialCityName ?? null}
          initialPrayer={initialPrayer ?? null}
          monthlyCalendar={monthlyCalendar ?? null}
          qibla={qibla ?? null}
          todayInfo={todayInfo ?? null}
        />
      </MuslimShell>
    </MainLayout>
  );
}
