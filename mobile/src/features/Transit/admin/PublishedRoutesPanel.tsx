import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { useAppTheme } from '@/contexts/ThemeContext';

import { TransitMapView } from '../_components/citymap/MapView';
import { useMapData } from '../_hooks/useMapData';
import type { City } from '../_types';
import {
  combinePublishedRoutes,
  getPublishedRouteGeoJson,
  getPublishedRouteStops,
  getPublishedRoutes,
  getTransitRouteLogs,
  movePublishedRoute,
  splitPublishedRoute,
  updatePublishedRoute,
  updatePublishedRouteStatus,
} from '../api';
import {
  buildPublishedRouteMapData,
  type TransitAdminAccess,
} from './model';
import { RouteColorSelector } from './RouteColorSelector';

const statusLabels = {
  disapproved: 'معطل',
  hidden: 'مخفي',
  published: 'منشور',
} as const;

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PublishedRoutesPanel({
  access,
  accountId,
  cities,
}: {
  access: TransitAdminAccess;
  accountId: number;
  cities: readonly City[];
}) {
  const { theme } = useAppTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  } | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [priceNew, setPriceNew] = useState('');
  const [priceOld, setPriceOld] = useState('');
  const [moveRouteId, setMoveRouteId] = useState('');
  const [targetCityId, setTargetCityId] = useState('');
  const [combineRouteAId, setCombineRouteAId] = useState('');
  const [combineRouteBId, setCombineRouteBId] = useState('');
  const [combineNameAr, setCombineNameAr] = useState('');
  const [combineNameEn, setCombineNameEn] = useState('');
  const [combinePrice, setCombinePrice] = useState('');
  const [splitRouteId, setSplitRouteId] = useState('');
  const [splitStopId, setSplitStopId] = useState('');
  const [splitNameAAr, setSplitNameAAr] = useState('');
  const [splitNameAEn, setSplitNameAEn] = useState('');
  const [splitNameBAr, setSplitNameBAr] = useState('');
  const [splitNameBEn, setSplitNameBEn] = useState('');

  const routesQuery = useQuery({
    enabled: access.editRoutes,
    queryFn: getPublishedRoutes,
    queryKey: ['transit-admin-published-routes', accountId],
  });
  const logsQuery = useQuery({
    enabled: access.viewLogs,
    queryFn: getTransitRouteLogs,
    queryKey: ['transit-admin-route-logs', accountId],
  });
  const routes = useMemo(
    () => (access.editRoutes ? routesQuery.data ?? [] : []),
    [access.editRoutes, routesQuery.data],
  );
  const selected = routes.find((route) => route.id === selectedId) ?? null;
  const geoJsonQuery = useQuery({
    enabled: access.editRoutes && selected !== null,
    queryFn: () => getPublishedRouteGeoJson(selected?.id ?? ''),
    queryKey: [
      'transit-admin-route-geojson',
      accountId,
      selected?.id,
    ],
  });
  const stopsQuery = useQuery({
    enabled: access.editRoutes && selected !== null,
    queryFn: () => getPublishedRouteStops(selected?.id ?? ''),
    queryKey: ['transit-admin-route-stops', accountId, selected?.id],
  });
  const reference = useMapData(selected?.city_id);
  const city =
    cities.find((item) => item.id === selected?.city_id) ??
    cities.find((item) => item.status === 'active') ??
    null;
  const mapData =
    selected && geoJsonQuery.data
      ? buildPublishedRouteMapData(
          { ...selected, color_index: colorIndex },
          geoJsonQuery.data,
          reference.data,
        )
      : null;

  const selectRoute = (route: (typeof routes)[number]) => {
    setSelectedId(route.id);
    setNameAr(route.name_ar);
    setNameEn(route.name_en ?? '');
    setColorIndex(route.color_index);
    setPriceNew(route.price_new === null ? '' : String(route.price_new));
    setPriceOld(route.price_old === null ? '' : String(route.price_old));
    setMoveRouteId(route.id);
    setTargetCityId('');
    setSplitRouteId(route.id);
    setSplitStopId('');
  };

  const refresh = async () => {
    await Promise.all([
      access.editRoutes ? routesQuery.refetch() : Promise.resolve(),
      access.viewLogs ? logsQuery.refetch() : Promise.resolve(),
    ]);
  };

  const runAction = async (action: () => Promise<void>, success: string) => {
    setActionPending(true);
    setActionMessage(null);
    try {
      await action();
      setActionMessage({ text: success, type: 'success' });
      await refresh();
    } catch (cause) {
      setActionMessage({
        text: cause instanceof Error ? cause.message : 'تعذر حفظ الإجراء.',
        type: 'error',
      });
    } finally {
      setActionPending(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppText variant="heading">إدارة الخطوط المنشورة</AppText>
      <AppText color="muted">
        راجع هندسة الخطوط، وعدل حالتها وبياناتها، أو أعد تنظيمها بين المدن.
      </AppText>
      {actionMessage ? (
        <AppCard
          style={{
            borderColor:
              actionMessage.type === 'success'
                ? theme.palette.success
                : theme.palette.danger,
          }}
        >
          <AppText
            color={actionMessage.type === 'success' ? 'success' : 'danger'}
          >
            {actionMessage.text}
          </AppText>
        </AppCard>
      ) : null}

      {access.editRoutes ? (
        routesQuery.isError ? (
          <QueryState
            detail="تعذر تحميل الخطوط المنشورة."
            onRetry={() => void routesQuery.refetch()}
            type="error"
          />
        ) : routesQuery.isPending ? (
          <AppText color="muted">جار تحميل الخطوط المنشورة...</AppText>
        ) : routes.length === 0 ? (
          <QueryState detail="لا توجد خطوط مسجلة." type="empty" />
        ) : (
          <View style={styles.routeList}>
            {routes.map((route) => (
              <Pressable
                accessibilityLabel={`إدارة ${route.name_ar}`}
                accessibilityRole="button"
                key={route.id}
                onPress={() => selectRoute(route)}
              >
                <AppCard
                  style={[
                    styles.routeCard,
                    {
                      borderColor:
                        selectedId === route.id
                          ? theme.palette.primary
                          : theme.palette.border,
                    },
                  ]}
                >
                  <View style={styles.row}>
                    <AppText style={styles.grow} variant="label">
                      {route.name_ar}
                    </AppText>
                    <AppText
                      color={
                        route.status === 'published'
                          ? 'success'
                          : route.status === 'disapproved'
                            ? 'danger'
                            : 'muted'
                      }
                      variant="caption"
                    >
                      {statusLabels[route.status]}
                    </AppText>
                  </View>
                  <AppText color="muted" variant="caption">
                    {route.city?.name_ar ?? route.city_id}،{' '}
                    {route.stops_count} محطة
                  </AppText>
                </AppCard>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {selected ? (
        <AppCard style={styles.detail}>
          <View style={styles.row}>
            <AppText style={styles.grow} variant="heading">
              {selected.name_ar}
            </AppText>
            <AppText color="primary">{statusLabels[selected.status]}</AppText>
          </View>
          {selected.name_en ? (
            <AppText color="muted">{selected.name_en}</AppText>
          ) : null}
          {city && mapData ? (
            <View style={styles.map}>
              <TransitMapView city={city} data={mapData} fitToData />
            </View>
          ) : geoJsonQuery.isPending ? (
            <AppText color="muted">جار تحميل هندسة الخط...</AppText>
          ) : null}
          <AppButton
            onPress={() =>
              router.push({
                params: { edit: selected.id },
                pathname: '/transit/studio',
              })
            }
            variant="secondary"
          >
            تعديل المسار على الخريطة
          </AppButton>

          <AppText variant="label">حالة الخط</AppText>
          <View style={styles.actions}>
            {selected.status !== 'published' ? (
              <AppButton
                loading={actionPending}
                onPress={() =>
                  void runAction(
                    () => updatePublishedRouteStatus(selected.id, 'published'),
                    'تم نشر الخط.',
                  )
                }
              >
                نشر الخط
              </AppButton>
            ) : (
              <AppButton
                loading={actionPending}
                onPress={() =>
                  void runAction(
                    () =>
                      updatePublishedRouteStatus(selected.id, 'disapproved'),
                    'تم تعطيل الخط.',
                  )
                }
                variant="danger"
              >
                تعطيل الخط
              </AppButton>
            )}
            <AppButton
              disabled={selected.status === 'hidden'}
              loading={actionPending}
              onPress={() =>
                void runAction(
                  () => updatePublishedRouteStatus(selected.id, 'hidden'),
                  'تم إخفاء الخط.',
                )
              }
              variant="secondary"
            >
              إخفاء الخط
            </AppButton>
          </View>

          <AppText variant="label">بيانات الخط</AppText>
          <AppInput
            onChangeText={setNameAr}
            placeholder="الاسم بالعربية"
            value={nameAr}
          />
          <AppInput
            onChangeText={setNameEn}
            placeholder="English route name"
            value={nameEn}
          />
          <AppInput
            keyboardType="number-pad"
            onChangeText={setPriceNew}
            placeholder="التعرفة الجديدة"
            value={priceNew}
          />
          <AppInput
            keyboardType="number-pad"
            onChangeText={setPriceOld}
            placeholder="التعرفة القديمة"
            value={priceOld}
          />
          <RouteColorSelector
            onChange={setColorIndex}
            value={colorIndex}
          />
          <AppButton
            disabled={!nameAr.trim()}
            loading={actionPending}
            onPress={() =>
              void runAction(
                () =>
                  updatePublishedRoute(selected.id, {
                    colorIndex,
                    nameAr: nameAr.trim(),
                    nameEn: nameEn.trim() || null,
                    priceNew: optionalNumber(priceNew),
                    priceOld: optionalNumber(priceOld),
                  }),
                'تم تحديث بيانات الخط.',
              )
            }
          >
            حفظ بيانات الخط
          </AppButton>

          <AppText variant="label">المحطات المرتبة</AppText>
          {stopsQuery.isPending ? (
            <AppText color="muted">جار تحميل المحطات...</AppText>
          ) : stopsQuery.data?.length ? (
            stopsQuery.data.map((stop, index) => (
              <AppText key={stop.id} variant="caption">
                {index + 1}. {stop.name_ar}
                {stop.name_en ? ` (${stop.name_en})` : ''}
              </AppText>
            ))
          ) : (
            <AppText color="muted" variant="caption">
              لا توجد محطات مرتبطة بالخط.
            </AppText>
          )}
        </AppCard>
      ) : null}

      {access.moveRoutes ? (
        <AppCard style={styles.detail}>
          <AppText variant="heading">نقل الخط إلى مدينة أخرى</AppText>
          <AppInput
            onChangeText={setMoveRouteId}
            placeholder="معرف الخط المراد نقله"
            value={moveRouteId}
          />
          <View style={styles.actions}>
            {cities
              .filter(
                (item) =>
                  item.status === 'active' &&
                  (!selected || item.id !== selected.city_id),
              )
              .map((item) => (
                <AppButton
                  key={item.id}
                  onPress={() => setTargetCityId(item.id)}
                  variant={
                    targetCityId === item.id ? 'primary' : 'secondary'
                  }
                >
                  {item.nameAr}
                </AppButton>
              ))}
          </View>
          <AppButton
            disabled={!moveRouteId.trim() || !targetCityId}
            loading={actionPending}
            onPress={() =>
              void runAction(
                () => movePublishedRoute(moveRouteId.trim(), targetCityId),
                'تم نقل الخط.',
              )
            }
          >
            نقل الخط
          </AppButton>
        </AppCard>
      ) : null}

      {access.splitRoutes ? (
        <AppCard style={styles.detail}>
          <AppText variant="heading">تقسيم المسار</AppText>
          <AppInput
            onChangeText={setSplitRouteId}
            placeholder="معرف الخط المراد تقسيمه"
            value={splitRouteId}
          />
          <AppInput
            onChangeText={setSplitStopId}
            placeholder="معرف محطة التقسيم"
            value={splitStopId}
          />
          {stopsQuery.data?.length ? (
            <View style={styles.actions}>
              {stopsQuery.data.slice(1, -1).map((stop) => (
                <AppButton
                  key={stop.id}
                  onPress={() => setSplitStopId(stop.id)}
                  variant={
                    splitStopId === stop.id ? 'primary' : 'secondary'
                  }
                >
                  التقسيم عند: {stop.name_ar}
                </AppButton>
              ))}
            </View>
          ) : null}
          <AppInput
            onChangeText={setSplitNameAAr}
            placeholder="اسم القسم الأول بالعربية"
            value={splitNameAAr}
          />
          <AppInput
            onChangeText={setSplitNameAEn}
            placeholder="First section English name"
            value={splitNameAEn}
          />
          <AppInput
            onChangeText={setSplitNameBAr}
            placeholder="اسم القسم الثاني بالعربية"
            value={splitNameBAr}
          />
          <AppInput
            onChangeText={setSplitNameBEn}
            placeholder="Second section English name"
            value={splitNameBEn}
          />
          <AppButton
            disabled={
              !splitRouteId.trim() ||
              !splitStopId.trim() ||
              !splitNameAAr.trim() ||
              !splitNameBAr.trim()
            }
            loading={actionPending}
            onPress={() =>
              void runAction(
                () =>
                  splitPublishedRoute({
                    nameAAr: splitNameAAr.trim(),
                    nameAEn: splitNameAEn.trim() || null,
                    nameBAr: splitNameBAr.trim(),
                    nameBEn: splitNameBEn.trim() || null,
                    routeId: splitRouteId.trim(),
                    splitStopId: splitStopId.trim(),
                  }),
                'تم تقسيم الخط.',
              )
            }
            variant="danger"
          >
            تقسيم الخط
          </AppButton>
        </AppCard>
      ) : null}

      {access.combineRoutes ? (
        <AppCard style={styles.detail}>
          <AppText variant="heading">دمج المسارات</AppText>
          <AppInput
            onChangeText={setCombineRouteAId}
            placeholder="معرف الخط الأول"
            value={combineRouteAId}
          />
          <AppInput
            onChangeText={setCombineRouteBId}
            placeholder="معرف الخط الثاني"
            value={combineRouteBId}
          />
          <AppInput
            onChangeText={setCombineNameAr}
            placeholder="اسم الخط المدمج بالعربية"
            value={combineNameAr}
          />
          <AppInput
            onChangeText={setCombineNameEn}
            placeholder="Combined route English name"
            value={combineNameEn}
          />
          <AppInput
            keyboardType="number-pad"
            onChangeText={setCombinePrice}
            placeholder="تعرفة الخط المدمج"
            value={combinePrice}
          />
          <AppButton
            disabled={
              !combineRouteAId.trim() ||
              !combineRouteBId.trim() ||
              combineRouteAId.trim() === combineRouteBId.trim() ||
              !combineNameAr.trim()
            }
            loading={actionPending}
            onPress={() =>
              void runAction(
                () =>
                  combinePublishedRoutes({
                    nameAr: combineNameAr.trim(),
                    nameEn: combineNameEn.trim() || null,
                    price: optionalNumber(combinePrice),
                    routeAId: combineRouteAId.trim(),
                    routeBId: combineRouteBId.trim(),
                  }),
                'تم دمج الخطين.',
              )
            }
          >
            دمج خطين
          </AppButton>
        </AppCard>
      ) : null}

      {access.viewLogs ? (
        <AppCard style={styles.detail}>
          <AppText variant="heading">سجل النشاط</AppText>
          {logsQuery.isError ? (
            <QueryState
              detail="تعذر تحميل سجل النشاط."
              onRetry={() => void logsQuery.refetch()}
              type="error"
            />
          ) : logsQuery.isPending ? (
            <AppText color="muted">جار تحميل السجل...</AppText>
          ) : logsQuery.data?.length ? (
            logsQuery.data.map((log) => (
              <View key={log.id} style={styles.log}>
                <AppText variant="label">{log.description}</AppText>
                <AppText color="muted" variant="caption">
                  {log.user?.name ?? 'النظام'}،{' '}
                  {new Date(log.created_at).toLocaleDateString('ar-SY')}
                </AppText>
              </View>
            ))
          ) : (
            <AppText color="muted">لا توجد أحداث مسجلة.</AppText>
          )}
        </AppCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  detail: {
    gap: 10,
  },
  grow: {
    flex: 1,
  },
  log: {
    gap: 3,
  },
  map: {
    height: 360,
    overflow: 'hidden',
  },
  root: {
    gap: 12,
  },
  routeCard: {
    gap: 6,
  },
  routeList: {
    gap: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/admin/Index.tsx (978 lines)
  confidence: high
  todos:      0
  notes:      Published route previews, status, metadata, city moves, combine, split, stop order, geometry editing, and logs use native bearer endpoints.
*/
