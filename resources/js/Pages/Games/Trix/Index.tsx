import React from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { TrixIcon } from '@/Components/Icons/ProjectIcons';
import GameShell from '../_components/GameShell';
import Trix, { TrixRules } from '../_components/Trix';

export default function Index() {
  return (
    <MainLayout>
      <Head>
        <title>تركس | الألعاب | Syrian Zone</title>
        <meta
          name="description"
          content="لعبة تركس بلا حكم: أربع ممالك وخمسة طلبات (البنات، الديناري، اللطوش، شيخ الكبة، التركس) بأربعة لاعبين — يهودية أو فريقين."
        />
        <meta property="og:title" content="تركس | الألعاب | Syrian Zone" />
        <meta property="og:description" content="تركس: خمسة طلبات وأربع ممالك، مع أو ضد شريكك." />
      </Head>

      <GameShell
        title="تركس"
        icon={TrixIcon}
        width="max-w-4xl"
        rules={<TrixRules />}
        fit
      >
        <Trix />
      </GameShell>
    </MainLayout>
  );
}
