import { Screen } from '@/components/ui/Screen';

import CompassApp from './CompassApp';

export default function CompassScreen() {
  return (
    <Screen
      subtitle="اختبر توجهاتك حول مستقبل سوريا"
      title="بوصلة سوريا السياسية"
    >
      <CompassApp />
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Compass/Index.tsx (52 lines)
  confidence: high
  todos:      0
  notes:      Inertia metadata moved to the Expo Router screen shell.
*/
