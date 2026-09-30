import React from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { TarneebIcon } from '@/Components/Icons/ProjectIcons';
import GameShell from '../_components/GameShell';
import Tarneeb, { TarneebRules } from '../_components/Tarneeb';

export default function Index() {
  return (
    <MainLayout>
      <Head>
        <title>طرنيب | الألعاب | Syrian Zone</title>
        <meta
          name="description"
          content="طرنيب ضد ثلاثة خصوم: زايد من ٧ إلى ١٣، اختر الحكم، واجمع الحيل حتى ٤١ نقطة. لعبة فريقين تلعبها في المتصفح."
        />
        <meta property="og:title" content="طرنيب | الألعاب | Syrian Zone" />
        <meta property="og:description" content="طرنيب: زايد، اختر الحكم، واجمع الحيل حتى ٤١ نقطة." />
      </Head>

      <GameShell
        title="طرنيب"
        description="زايد من ٧ إلى ١٣، واختَر الحكم، واجمع الحيل حتى ٤١"
        icon={TarneebIcon}
        width="max-w-4xl"
        rules={<TarneebRules />}
      >
        <Tarneeb />
      </GameShell>
    </MainLayout>
  );
}
