import { Slot } from 'expo-router';

import TransitLayout from '@/features/Transit/layout';

export default function TransitRouteLayout() {
  return (
    <TransitLayout>
      <Slot />
    </TransitLayout>
  );
}
