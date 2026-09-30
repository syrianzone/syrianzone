import React from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { SolitaireIcon } from '@/Components/Icons/ProjectIcons';
import GameShell from '../_components/GameShell';
import Solitaire, { SolitaireRules } from '../_components/Solitaire';

export default function Index() {
  return (
    <MainLayout>
      <Head>
        <title>سوليتير | الألعاب | Syrian Zone</title>
        <meta
          name="description"
          content="سوليتير بالبطاقات: رتّب الأعمدة من ٢ إلى ١٣ وابنِ الأساس، وأفضل وقتك يُحفظ على جهازك. يعمل باللمس والسحب."
        />
        <meta property="og:title" content="سوليتير | الألعاب | Syrian Zone" />
        <meta
          property="og:description"
          content="رتّب الأعمدة من ٢ إلى ١٣ وابنِ الأساس — لعب سريع بلا تحميل."
        />
      </Head>

      <GameShell
        title="سوليتير"
        description="رتّب الأعمدة من ٢ إلى ١٣"
        icon={SolitaireIcon}
        width="max-w-6xl"
        rules={<SolitaireRules />}
      >
        <Solitaire />
      </GameShell>
    </MainLayout>
  );
}
