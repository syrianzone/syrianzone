import { UserLocation } from '@maplibre/maplibre-react-native';

export function UserLocationLayer({ visible }: { visible: boolean }) {
  return visible ? <UserLocation accuracy heading /> : null;
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/UserLocationLayer.tsx (76 lines)
  confidence: high
  todos:      0
  notes:      MapLibre native location rendering replaces the browser marker.
*/
