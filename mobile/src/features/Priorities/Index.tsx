import { Screen } from '@/components/ui/Screen';

import PrioritiesApp from './PrioritiesApp';

export default function PrioritiesScreen() {
  return (
    <Screen
      subtitle="وزع مئة نقطة على الملفات الأكثر إلحاحاً"
      title="أولويات سوريا"
    >
      <PrioritiesApp />
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Priorities/Index.tsx (61 lines)
  confidence: high
  todos:      0
  notes:      Metadata and share cards moved into the native screen.
*/
