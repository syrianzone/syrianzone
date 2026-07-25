import { MapCanvas } from '@/Components/map/MapCanvas';
import { FlyTo } from '@/Components/map/FlyTo';
import { PlacesLayer } from './PlacesLayer';
import { HotelsLayer } from './HotelsLayer';
import { MapInteractions } from './MapInteractions';
import { HighlightMarker } from './HighlightMarker';
import type { HotelFeatureCollection, LatLng, PlaceFeatureCollection } from '../_lib/types';

export function PlacesMap(props: {
  features: PlaceFeatureCollection;
  hotelFeatures: HotelFeatureCollection;
  selectedId: number | null;
  selectedType: 'place' | 'hotel' | null;
  addMode: boolean;
  focus: { lng: number; lat: number; zoom?: number; key: number } | null;
  highlight: LatLng | null;
  onPinClick: (id: number) => void;
  onHotelPinClick: (id: number) => void;
  onMapClick: (point: LatLng) => void;
  className?: string;
}) {
  return (
    <MapCanvas center={[38.0, 35.0]} zoom={6.2} className={props.className}>
      <PlacesLayer
        data={props.features as GeoJSON.FeatureCollection}
        selectedId={props.selectedType === 'place' ? props.selectedId : null}
        onPinClick={props.onPinClick}
        onClusterClick={(zoom, center) => {}}
      />
      <HotelsLayer
        data={props.hotelFeatures as GeoJSON.FeatureCollection}
        selectedId={props.selectedType === 'hotel' ? props.selectedId : null}
        onPinClick={props.onHotelPinClick}
        onClusterClick={(zoom, center) => {}}
      />
      <MapInteractions addMode={props.addMode} onMapClick={props.onMapClick} />
      <HighlightMarker point={props.highlight} />
      {props.focus && (
        <FlyTo lng={props.focus.lng} lat={props.focus.lat} zoom={props.focus.zoom} key={props.focus.key} />
      )}
    </MapCanvas>
  );
}
