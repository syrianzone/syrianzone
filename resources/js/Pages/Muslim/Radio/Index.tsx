import React from 'react';
import { router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { QuranRadioIcon } from '@/Components/Icons/ProjectIcons';
import MuslimShell from '../_components/MuslimShell';
import RadioView from '../_components/RadioView';
import { useQuranTarget } from '@/Domain/quran/targetAyah';

export default function Index() {
  const setTargetAyah = useQuranTarget((s) => s.setTargetAyah);

  // Continue in the reader: the player is global, so it keeps playing; we just
  // hand the reader the ayah being recited and open its route.
  const continueToReader = (surah: number, ayah: number) => {
    setTargetAyah(`${surah}:${ayah}`);
    router.visit('/muslim/quran');
  };

  return (
    <MainLayout>
      

      <MuslimShell title="إذاعة القرآن" icon={QuranRadioIcon}>
        <RadioView onContinue={continueToReader} />
      </MuslimShell>
    </MainLayout>
  );
}
