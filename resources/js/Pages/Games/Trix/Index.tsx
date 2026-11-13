import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import GameShell from '../_components/GameShell';
import Trix, { TrixRules } from '../_components/Trix';
import './styles.css';

export default function Index() {
  return (
    <MainLayout>
      <GameShell slug="trix" width="max-w-4xl" rules={<TrixRules />} fit>
        <Trix />
      </GameShell>
    </MainLayout>
  );
}
