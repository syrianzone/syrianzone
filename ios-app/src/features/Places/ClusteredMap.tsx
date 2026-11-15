import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { MapView, type MapCameraChange, type MapPin } from '../../MapView';
import type { Coordinate } from '../../domain';
import { createPinIndex, sourceZoomForViewport } from './clusters';

export function ClusteredPlacesMap({ pins, camera, onPinPress, onMapPress, onCameraChange, focus }: {
  pins: MapPin[]; camera: { coordinates: Coordinate; zoom: number };
  onPinPress(id: string): void; onMapPress(coordinate: Coordinate): void; onCameraChange(camera: MapCameraChange): void;
  focus(camera: { coordinates: Coordinate; zoom: number }): void;
}): React.JSX.Element {
  const [size, setSize] = useState({ width: 0, height: 0 }), [viewport, setViewport] = useState<MapCameraChange | null>(null);
  const placeIndex = useMemo(() => createPinIndex('place', pins.filter(pin => pin.id.startsWith('place:'))), [pins]);
  const hotelIndex = useMemo(() => createPinIndex('hotel', pins.filter(pin => pin.id.startsWith('hotel:'))), [pins]);
  const displayed = useMemo(() => {
    const bounds: [number, number, number, number] = viewport ? [viewport.bounds.west, viewport.bounds.south, viewport.bounds.east, viewport.bounds.north] : [-180, -85, 180, 85];
    const zoom = viewport ? sourceZoomForViewport(viewport.longitudeDelta, size.width) : sourceZoomForViewport(360 / 2 ** camera.zoom, size.width || 512);
    return [...placeIndex.query(bounds, zoom), ...hotelIndex.query(bounds, zoom), ...pins.filter(pin => !pin.id.startsWith('place:') && !pin.id.startsWith('hotel:'))];
  }, [viewport, size.width, camera.zoom, placeIndex, hotelIndex, pins]);
  return <View style={{ flex: 1 }} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}><MapView pins={displayed} camera={camera} onMapPress={onMapPress} onCameraChange={value => { setViewport(value); onCameraChange(value); }} onPinPress={id => {
    const expanded = placeIndex.expand(id, size.width, size.height) ?? hotelIndex.expand(id, size.width, size.height);
    if (expanded) focus({ coordinates: expanded.coordinates, zoom: expanded.zoom }); else onPinPress(id);
  }} /></View>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/PinLayer.tsx; confidence medium; todos 1 native count-label and expansion verification.
