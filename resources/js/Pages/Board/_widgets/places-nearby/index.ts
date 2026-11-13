import { MapPin } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export interface PlacesNearbyConfig {
  radius_km: number;
}

export const placesNearbyWidget: WidgetDeclaration = {
  id: 'places-nearby',
  name: 'أماكن قريبة',
  description: 'مشاوير قريبة من موقعك',
  icon: MapPin,
  category: 'places',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  // the api caps radius_km at 25
  fields: [
    { key: 'radius_km', type: 'number', label: 'نطاق البحث (كم)', default: 10, min: 1, max: 25 },
  ],
  requires: ['geo'],
  refresh: { staleMs: 5 * 60_000, intervalMs: null },
  multiple: false,
  seed: null,
  source: sources.nearby,
};

export default placesNearbyWidget;
