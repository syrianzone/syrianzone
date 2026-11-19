import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { AppleMaps } from 'expo-maps';
import { isCoordinate, type Coordinate } from './domain';
import { cameraForCoordinates } from './map-data';
import { EmptyState } from './components';
import { useTheme } from './ui/theme';

export interface MapPin { id: string; name: string; coordinate: Coordinate; symbol?: string; color?: string; monogram?: string }
export interface MapLine { id: string; coordinates: Coordinate[]; color: string }
export interface MapCameraChange {
  center: Coordinate; zoom: number; latitudeDelta: number; longitudeDelta: number;
  bounds: { north: number; east: number; south: number; west: number };
}

export function MapView({ pins, lines = [], center, camera: requestedCamera, onPinPress, onLinePress, onMapPress, onCameraChange }: {
  pins: MapPin[]; lines?: MapLine[]; center?: Coordinate | null;
  camera?: { coordinates: Coordinate; zoom: number };
  onPinPress?(id: string): void; onLinePress?(id: string): void;
  onMapPress?(coordinate: Coordinate): void; onCameraChange?(camera: MapCameraChange): void;
}): React.JSX.Element {
  const { mode, colors } = useTheme();
  const map = useRef<React.ComponentRef<typeof AppleMaps.View>>(null);
  const camera = useMemo(() => requestedCamera ?? cameraForCoordinates(lines.length ? lines.flatMap(line => line.coordinates) : pins.length ? pins.map(pin => pin.coordinate) : center ? [center] : []), [lines, pins, center, requestedCamera]);
  const markers = useMemo(() => pins.map(pin => ({ id: pin.id, title: pin.name, coordinates: pin.coordinate,
    ...(pin.monogram ? { monogram: pin.monogram } : { systemImage: pin.symbol ?? 'mappin' }), tintColor: pin.color ?? colors.accent })), [pins, colors.accent]);
  const polylines = useMemo(() => lines.map(line => ({ ...line, width: 5 })), [lines]);
  const latitude = requestedCamera?.coordinates.latitude, longitude = requestedCamera?.coordinates.longitude, zoom = requestedCamera?.zoom;
  useEffect(() => { if (latitude !== undefined && longitude !== undefined && zoom !== undefined) void map.current?.setCameraPosition({ coordinates: { latitude, longitude }, zoom }); }, [latitude, longitude, zoom]);
  if (!camera) return <EmptyState symbol="map" title="لا توجد بيانات خريطة بعد" />;
  return <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', minHeight: 220 }}>
    <AppleMaps.View ref={map} style={{ flex: 1 }} cameraPosition={camera} markers={markers} polylines={polylines}
      {...(onMapPress && !onLinePress ? { properties: { polylineTapThreshold: 0 } } : {})}
      colorScheme={mode === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
      uiSettings={{ compassEnabled: true, scaleBarEnabled: true, myLocationButtonEnabled: false }}
      onMarkerClick={event => { if (event.id) onPinPress?.(event.id); }}
      onMapClick={event => { if (isCoordinate(event.coordinates)) onMapPress?.(event.coordinates); }}
      onCameraMove={event => {
        if (!isCoordinate(event.coordinates) || !Number.isFinite(event.zoom) || !Number.isFinite(event.latitudeDelta) || !Number.isFinite(event.longitudeDelta)) return;
        onCameraChange?.({ center: event.coordinates, zoom: event.zoom, latitudeDelta: event.latitudeDelta, longitudeDelta: event.longitudeDelta,
          bounds: { north: Math.min(90, event.coordinates.latitude + event.latitudeDelta / 2), south: Math.max(-90, event.coordinates.latitude - event.latitudeDelta / 2),
            east: Math.min(180, event.coordinates.longitude + event.longitudeDelta / 2), west: Math.max(-180, event.coordinates.longitude - event.longitudeDelta / 2) } });
      }}
      onPolylineClick={event => { if (event.id) onLinePress?.(event.id); }} />
  </View>;
}
