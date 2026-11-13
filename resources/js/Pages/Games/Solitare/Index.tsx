import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import GameShell from '../_components/GameShell';
import Solitaire, { SolitaireRules } from '../_components/Solitaire';
import './styles.css';

export default function Index() {
  return (
    <MainLayout>
      <GameShell slug="solitare" width="max-w-6xl" rules={<SolitaireRules />}>
        <Solitaire />
      </GameShell>
    </MainLayout>
  );
}
