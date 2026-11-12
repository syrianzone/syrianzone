import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import { MuslimIcon } from '@/Components/Icons/ProjectIcons';
import MuslimShell from '../_components/MuslimShell';
import PrayerView from '../_components/PrayerView';
import { useMuslimPrefs } from '../../../Domain/settings/prefs';

export default function Index() {
  const { prefs, setPrefs, isLoggedIn } = useMuslimPrefs();

  return (
    <MainLayout>
      

      <MuslimShell title="مواقيت الصلاة" icon={MuslimIcon}>
        <PrayerView prefs={prefs} setPrefs={setPrefs} isLoggedIn={isLoggedIn} />
      </MuslimShell>
    </MainLayout>
  );
}
