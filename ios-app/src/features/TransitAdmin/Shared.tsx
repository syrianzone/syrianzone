import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { api, ApiError } from '../../api';
import { AdaptivePanes, contentStyle, Heading, Label, RequestStatus } from '../../components';
import { routeColor, type City } from '../../domain';
import { MapView } from '../../MapView';
import { useAccount } from '../../platform/account';
import { useResource } from '../../resource';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { cameraForCoordinates } from '../../map-data';
import facts from '../../../../resources/data/transit.json';
import { canInCity, type Geometry } from './model';

export function useTransitManager() {
  const account = useAccount(),
    { colors } = useTheme();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [fields, setFields] = useState<Readonly<Record<string, readonly string[]>>>({});
  const current = useRef(account),
    alive = useRef(true),
    writing = useRef(false);
  current.current = account;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const permissions = account.user?.effective_permissions ?? [],
    scope = account.user?.transit_scope ?? null;
  const can = (permission: string, cities: readonly string[] = []) =>
    account.ready && !account.busy && permissions.includes(permission) && cities.every((city) => canInCity(permissions, scope, permission, city));
  const perform = async (permission: string, cities: readonly string[], task: (generation: number) => Promise<string | null>): Promise<boolean> => {
    const owner = current.current,
      caps = owner.user?.effective_permissions ?? [];
    if (
      writing.current ||
      !owner.ready ||
      owner.busy ||
      !caps.includes(permission) ||
      !cities.every((city) => canInCity(caps, owner.user?.transit_scope ?? null, permission, city))
    )
      return false;
    const generation = owner.sessionGeneration;
    writing.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    setFields({});
    try {
      const result = await task(generation);
      if (alive.current && generation === api.getSessionGeneration()) setNotice(result);
      return alive.current && generation === api.getSessionGeneration();
    } catch (reason) {
      if (alive.current && generation === api.getSessionGeneration()) {
        setError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء.');
        if (reason instanceof ApiError) setFields(reason.fields);
      }
      return false;
    } finally {
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return { account, can, scope, permissions, busy: busy || account.busy, error, notice, fields, perform, colors };
}
export type TransitManager = ReturnType<typeof useTransitManager>;
export function Messages({ manager }: { manager: TransitManager }): React.JSX.Element {
  return (
    <>
      {manager.error ? <Label style={{ color: manager.colors.danger }}>{manager.error}</Label> : null}
      {manager.notice ? <Label style={{ color: manager.colors.success }}>{manager.notice}</Label> : null}
    </>
  );
}
export function CityPicker({
  cities,
  value,
  onChange,
  all = false,
  disabled = false,
  label = 'المدينة'
}: {
  cities: readonly City[];
  value: string;
  onChange(value: string): void;
  all?: boolean;
  disabled?: boolean;
  label?: string;
}): React.JSX.Element {
  return (
    <NativePicker
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={[
        ...(all ? [{ value: 'all', label: 'كل المدن' }] : [{ value: '', label: 'اختر المدينة' }]),
        ...cities.map((city) => ({ value: String(city.id), label: city.nameAr }))
      ]}
    />
  );
}
export function ColorPicker({
  value,
  onChange,
  disabled = false
}: {
  value: number;
  onChange(value: number): void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignSelf: 'flex-start', width: 36, height: 12, borderRadius: 6, backgroundColor: routeColor(value) }} />
      <NativePicker
        label="لون الخط"
        value={String(value)}
        onChange={(selected) => onChange(Number(selected))}
        disabled={disabled}
        options={[
          ...facts.route_palette.map((_, index) => ({ value: String(index), label: `لون ${index + 1}` })),
          ...(value >= facts.route_palette.length ? [{ value: String(value), label: `اللون الحالي ${value + 1}` }] : [])
        ]}
      />
    </View>
  );
}
export function AdminSheet({
  title,
  visible,
  busy,
  onClose,
  children
}: {
  title: string;
  visible: boolean;
  busy: boolean;
  onClose(): void;
  children: ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AdaptivePanes
          primary={
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
              <Heading>{title}</Heading>
              {children}
              <NativeAction title="إلغاء" onPress={onClose} disabled={busy} />
            </ScrollView>
          }
        />
      </View>
    </Modal>
  );
}
export function GeometryMap({
  geometry,
  cityId,
  color,
  onReferenceRoute
}: {
  geometry: Geometry;
  cityId: string;
  color: number;
  onReferenceRoute?(id: string): void;
}): React.JSX.Element {
  const reference = useResource(
    useCallback((signal) => api.transitMap(cityId, signal), [cityId]),
    { enabled: Boolean(cityId) }
  );
  const [showReference, setShowReference] = useState(true);
  const camera = useMemo(() => cameraForCoordinates(geometry.segments.flat().concat(geometry.stops.map((stop) => stop.coordinate))), [geometry]);
  const lines = useMemo(
    () => [
      ...(showReference
        ? (reference.data?.routes.flatMap((route) =>
            route.segments.map((coordinates, index) => ({
              id: `reference:${route.id}:${index}`,
              coordinates,
              color: `${routeColor(route.colorIndex)}44`
            }))
          ) ?? [])
        : []),
      ...geometry.segments.map((coordinates, index) => ({ id: `selected:${index}`, coordinates, color: routeColor(color) }))
    ],
    [reference.data, showReference, geometry, color]
  );
  const pins = useMemo(
    () => [
      ...(showReference
        ? (reference.data?.stops.map((stop) => ({
            id: `reference-stop:${stop.id}`,
            name: stop.name,
            coordinate: stop.coordinate,
            color: routeColor(0)
          })) ?? [])
        : []),
      ...geometry.stops.map((stop, index) => ({
        id: `selected-stop:${index}`,
        name: stop.name || `محطة ${index + 1}`,
        coordinate: stop.coordinate,
        color: routeColor(color),
        monogram: String(index + 1)
      }))
    ],
    [reference.data, showReference, geometry, color]
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 320 }}>
        <MapView
          pins={pins}
          lines={lines}
          {...(camera ? { camera } : {})}
          onLinePress={(id) => {
            if (id.startsWith('reference:')) {
              const value = id.slice(10);
              onReferenceRoute?.(value.slice(0, value.lastIndexOf(':')));
            }
          }}
        />
      </View>
      <Label secondary>الخط الباهت منشور، والخط اللامع هو المسار المحدد.</Label>
      <NativeAction
        title={showReference ? 'إخفاء البيانات المنشورة للمقارنة' : 'إظهار البيانات المنشورة للمقارنة'}
        onPress={() => setShowReference((value) => !value)}
      />
      {showReference ? <RequestStatus resource={reference} /> : null}
    </View>
  );
}
// PORT STATUS: source Transit/admin native shared controls; confidence medium; todos 1 compact and accessibility device review.
