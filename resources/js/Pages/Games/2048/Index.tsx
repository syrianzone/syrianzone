import React from 'react';

import MainLayout from '@/Layouts/MainLayout';
import GameShell from '../_components/GameShell';
import Game2048, { Game2048Rules } from '../_components/Game2048';
import './styles.css';

export default function Index() {
  return (
    <MainLayout>
      <GameShell slug="2048" rules={<Game2048Rules />}>
        <Game2048 />
      </GameShell>
    </MainLayout>
  );
}
