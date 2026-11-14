import { useMemo } from 'react';
import { View } from 'react-native';
import { AppleMaps } from 'expo-maps';
import type { Coordinate } from './domain';
import { cameraForCoordinates } from './map-data';
import { EmptyState } from './components';
import { useTheme } from './ui/theme';

export interface MapPin { id: string; name: string; coordinate: Coordinate; symbol?: string }
export interface MapLine { id: string; coordinates: Coordinate[]; color: string }

export function MapView({ pins, lines = [], center, onPinPress, onLinePress }: {
  pins: MapPin[]; lines?: MapLine[]; center?: Coordinate | null;
  onPinPress?(id: string): void; onLinePress?(id: string): void;
}): React.JSX.Element {
  const { mode, colors } = useTheme();
  const camera = useMemo(() => cameraForCoordinates(lines.length ? lines.flatMap(line => line.coordinates) : pins.length ? pins.map(pin => pin.coordinate) : center ? [center] : []), [lines, pins, center]);
  const markers = useMemo(() => pins.map(pin => ({ id: pin.id, title: pin.name, coordinates: pin.coordinate, systemImage: pin.symbol ?? 'mappin', tintColor: colors.accent })), [pins, colors.accent]);
  const polylines = useMemo(() => lines.map(line => ({ ...line, width: 5 })), [lines]);
  if (!camera) return <EmptyState symbol="map" title="لا توجد بيانات خريطة بعد" />;
  return <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', minHeight: 220 }}>
    <AppleMaps.View style={{ flex: 1 }} cameraPosition={camera} markers={markers} polylines={polylines}
      colorScheme={mode === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
      uiSettings={{ compassEnabled: true, scaleBarEnabled: true, myLocationButtonEnabled: false }}
      onMarkerClick={event => { if (event.id) onPinPress?.(event.id); }}
      onPolylineClick={event => { if (event.id) onLinePress?.(event.id); }} />
  </View>;
}
