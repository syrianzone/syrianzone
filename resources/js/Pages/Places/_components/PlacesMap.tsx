import { MapCanvas } from '@/Components/map/MapCanvas';
import { FlyTo } from '@/Components/map/FlyTo';
import { HOTEL_PINS, PLACE_PINS, PinLayer } from './PinLayer';
import { MapInteractions } from './MapInteractions';
import { HighlightMarker } from './HighlightMarker';
import type { HotelFeatureCollection, LatLng, PlaceFeatureCollection } from '@/Domain/places/types';

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
      <PinLayer
        style={PLACE_PINS}
        data={props.features}
        selectedId={props.selectedType === 'place' ? props.selectedId : null}
        onPinClick={props.onPinClick}
        onClusterClick={() => {}}
      />
      <PinLayer
        style={HOTEL_PINS}
        data={props.hotelFeatures}
        selectedId={props.selectedType === 'hotel' ? props.selectedId : null}
        onPinClick={props.onHotelPinClick}
        onClusterClick={() => {}}
      />
      <MapInteractions addMode={props.addMode} onMapClick={props.onMapClick} />
      <HighlightMarker point={props.highlight} />
      {props.focus && (
        <FlyTo lng={props.focus.lng} lat={props.focus.lat} zoom={props.focus.zoom} trigger={props.focus.key} />
      )}
    </MapCanvas>
  );
}
