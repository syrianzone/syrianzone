import React from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Game2048Icon } from '@/Components/Icons/ProjectIcons';
import GameShell from '../_components/GameShell';
import Game2048, { Game2048Rules } from '../_components/Game2048';

export default function Index() {
  return (
    <MainLayout>
      <Head>
        <title>2048 | الألعاب | Syrian Zone</title>
        <meta
          name="description"
          content="لعبة 2048 بالعربية: ادمج الأرقام المتشابهة لتصل إلى 2048. تعمل بالأسهم واللمس، وتحفظ أفضل نتيجة على جهازك."
        />
        <meta property="og:title" content="2048 | الألعاب | Syrian Zone" />
        <meta
          property="og:description"
          content="ادمج الأرقام المتشابهة لتصل إلى 2048 — تلعبها من المتصفح مباشرة."
        />
      </Head>

      <GameShell
        title="2048"
        description="ادمج الأرقام المتشابهة لتصل إلى 2048"
        icon={Game2048Icon}
        rules={<Game2048Rules />}
      >
        <Game2048 />
      </GameShell>
    </MainLayout>
  );
}
