import { Screen } from '@/components/ui/Screen';

import CompassClient from './CompassClient';

export default function AlignmentScreen() {
  return (
    <Screen
      subtitle="ضع الأشخاص أو الأحزاب على محاور تختارها"
      title="البوصلة المخصصة"
    >
      <CompassClient />
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Alignment/Index.tsx (16 lines)
  confidence: high
  todos:      0
  notes:      The server wrapper became an Expo Router screen.
*/
