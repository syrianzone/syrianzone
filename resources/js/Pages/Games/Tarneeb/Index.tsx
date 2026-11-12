import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import GameShell from '../_components/GameShell';
import Tarneeb, { TarneebRules } from '../_components/Tarneeb';

export default function Index() {
  return (
    <MainLayout>
      <GameShell slug="tarneeb" width="max-w-4xl" rules={<TarneebRules />} fit>
        <Tarneeb />
      </GameShell>
    </MainLayout>
  );
}
