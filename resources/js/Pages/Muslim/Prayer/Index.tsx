import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import { MuslimIcon } from '@/Components/Icons/ProjectIcons';
import MuslimShell from '../_components/MuslimShell';
import PrayerView from '../_components/PrayerView';
import { useMuslimPrefs } from '../../../Domain/settings/prefs';
import type { PrayerHijri } from '../../../Domain/prayer/times';

interface PrayerPageProps {
  initialCity?: string | null;
  initialCityName?: string | null;
  initialPrayer?: {
    governorate: string;
    method: number;
    timings: Record<string, string>;
    hijri: PrayerHijri | null;
  } | null;
}

export default function Index({ initialCity, initialCityName, initialPrayer }: PrayerPageProps) {
  const { prefs, setPrefs, isLoggedIn } = useMuslimPrefs();

  return (
    <MainLayout>
      <MuslimShell title={initialCityName ? `مواقيت الصلاة في ${initialCityName}` : 'مواقيت الصلاة'} icon={MuslimIcon}>
        <PrayerView
          prefs={prefs}
          setPrefs={setPrefs}
          isLoggedIn={isLoggedIn}
          initialCity={initialCity ?? null}
          initialPrayer={initialPrayer ?? null}
        />
      </MuslimShell>
    </MainLayout>
  );
}
