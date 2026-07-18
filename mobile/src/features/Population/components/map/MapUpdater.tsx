import { Camera } from '@maplibre/maplibre-react-native';

export default function MapUpdater() {
  return <Camera center={[38.4, 35]} zoom={5.3} />;
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/components/map/MapUpdater.tsx (29 lines)
  confidence: high
  todos:      0
  notes:      A declarative native camera replaces browser map instance mutation.
*/
