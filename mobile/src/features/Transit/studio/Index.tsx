import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  MapPin,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';

import { TransitMapView } from '../_components/citymap/MapView';
import cities from '../_data/cities';
import { transitFallback } from '../_data/fallback';
import { useMapData } from '../_hooks/useMapData';
import { useStudioStore } from '../_store/useStudioStore';
import type { City, MapDataResponse } from '../_types';
import { submitRouteDraft } from '../api';
import {
  appendCoordinate,
  buildTransitDraftGeoJson,
  hasPublishedRouteConflict,
  selfIntersections,
  undoCoordinate,
} from './model';

const emptyMapData: MapDataResponse = {
  routes: { features: [], type: 'FeatureCollection' },
  stops: { features: [], type: 'FeatureCollection' },
};

export default function TransitStudioScreen() {
  const { theme } = useAppTheme();
  const store = useStudioStore();
  const [editMode, setEditMode] = useState<'line' | 'stops'>('line');
  const cityId = store.cityId || 'damascus';
  const city = cities.find((item) => item.id === cityId) as City;
  const live = useMapData(cityId);
  const baseData = live.data ?? transitFallback(cityId) ?? emptyMapData;
  const intersections = selfIntersections(store.drawnLine ?? []);
  const mapData = useMemo<MapDataResponse>(() => {
    const draftRoutes =
      store.drawnLine && store.drawnLine.length >= 2
        ? [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: store.drawnLine,
              },
              properties: {
                colorIndex: 2,
                id: 'draft-preview',
                nameAr: store.nameAr || 'مسودة خط',
              },
            },
          ]
        : [];
    const draftStops = store.stops.map((stop, index) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: stop.coordinates },
      properties: {
        id: `draft-stop-${stop.id}`,
        nameAr: stop.nameAr || `محطة ${index + 1}`,
        routeIds: [] as string[],
      },
    }));
    return {
      ...baseData,
      routes: {
        ...baseData.routes,
        features: [...baseData.routes.features, ...draftRoutes],
      },
      stops: {
        ...baseData.stops,
        features: [...baseData.stops.features, ...draftStops],
      },
    };
  }, [baseData, store.drawnLine, store.nameAr, store.stops]);
  const conflictWarning =
    store.drawnLine !== null &&
    hasPublishedRouteConflict(store.drawnLine, baseData.routes.features);
  const submit = useMutation({
    mutationFn: () => {
      if (!store.drawnLine || store.drawnLine.length < 2) {
        throw new Error('A route needs at least two coordinates');
      }
      return submitRouteDraft({
        cityId,
        coordinates: store.drawnLine,
        nameAr: store.nameAr,
        nameEn: store.nameEn,
        notes: store.notes,
        price: store.price ? Number(store.price) : undefined,
        stops: store.stops,
      });
    },
    onSuccess: (draft) => store.setSubmittedDraftId(draft.id),
  });
  const exportGeoJson = async () => {
    if (!store.drawnLine || !(await Sharing.isAvailableAsync())) {
      return;
    }
    const file = new File(Paths.cache, 'transit-route-draft.geojson');
    file.create({ overwrite: true });
    file.write(
      JSON.stringify(
        buildTransitDraftGeoJson(store.drawnLine, store.stops, {
          cityId,
          nameAr: store.nameAr,
          nameEn: store.nameEn,
        }),
        null,
        2,
      ),
    );
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/geo+json',
      UTI: 'public.json',
    });
  };
  return (
    <Screen title="استوديو الترانزيت">
      <AppCard style={styles.section}>
        <AppText variant="heading">1. اختر المدينة</AppText>
        <View style={styles.cityList}>
          {cities.filter((item) => item.status === 'active').map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (item.id !== cityId) {
                  store.reset();
                  submit.reset();
                  setEditMode('line');
                }
                store.setCity(item.id);
              }}
              style={[
                styles.city,
                {
                  borderColor:
                    item.id === cityId
                      ? theme.palette.primary
                      : theme.palette.border,
                },
              ]}
            >
              <AppText variant="label">{item.nameAr}</AppText>
            </Pressable>
          ))}
        </View>
      </AppCard>
      <AppCard style={styles.section}>
        <AppText variant="heading">2. ارسم المسار وحدد المحطات</AppText>
        <AppText color="muted">
          اختر وضع المسار أو المحطات، ثم اضغط على الخريطة لإضافة النقاط بالترتيب.
        </AppText>
        <View style={styles.modeButtons}>
          <AppButton
            icon={
              <Pencil
                color={
                  editMode === 'line'
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground
                }
                size={18}
              />
            }
            onPress={() => setEditMode('line')}
            variant={editMode === 'line' ? 'primary' : 'secondary'}
          >
            رسم المسار
          </AppButton>
          <AppButton
            disabled={!store.drawnLine || store.drawnLine.length < 2}
            icon={
              <MapPin
                color={
                  editMode === 'stops'
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground
                }
                size={18}
              />
            }
            onPress={() => setEditMode('stops')}
            variant={editMode === 'stops' ? 'primary' : 'secondary'}
          >
            إضافة محطات
          </AppButton>
        </View>
        <View style={styles.map}>
          <TransitMapView
            city={city}
            data={mapData}
            onMapPress={(coordinate) => {
              if (editMode === 'stops') {
                if (store.stops.length < 100) {
                  store.addStop(coordinate);
                }
                return;
              }
              store.setDrawnLine(
                appendCoordinate(store.drawnLine, coordinate),
              );
            }}
          />
        </View>
        <AppText color={intersections.length ? 'danger' : 'muted'} variant="caption">
          {store.drawnLine?.length ?? 0} نقطة
          {intersections.length ? `، يوجد ${intersections.length} تقاطع ذاتي` : ''}
        </AppText>
        {conflictWarning ? (
          <AppText color="danger" variant="caption">
            يبدو أن هناك مساراً منشوراً قريباً. راجع المسار وتأكد أنه يضيف تغطية جديدة.
          </AppText>
        ) : null}
        <AppButton
          disabled={!store.drawnLine}
          icon={<Undo2 color={theme.palette.foreground} size={18} />}
          onPress={() => {
            const nextLine = undoCoordinate(store.drawnLine);
            store.setDrawnLine(nextLine);
            if (!nextLine || nextLine.length < 2) {
              setEditMode('line');
            }
          }}
          variant="secondary"
        >
          تراجع
        </AppButton>
      </AppCard>
      <AppCard style={styles.section}>
        <AppText variant="heading">3. أسماء المحطات</AppText>
        <AppText color="muted">
          المحطات اختيارية. يمكنك تسميتها الآن أو ترك الاسم فارغاً ليعينه فريق المراجعة.
        </AppText>
        {store.stops.length ? (
          store.stops.map((stop, index) => (
            <View key={stop.id} style={styles.stopRow}>
              <AppText style={styles.stopNumber} variant="label">
                {index + 1}
              </AppText>
              <AppInput
                onChangeText={(nameAr) => store.updateStopName(stop.id, nameAr)}
                placeholder="اسم المحطة بالعربية"
                style={styles.stopInput}
                value={stop.nameAr}
              />
              <Pressable
                accessibilityLabel={`حذف المحطة ${index + 1}`}
                accessibilityRole="button"
                onPress={() => store.removeStop(stop.id)}
                style={({ pressed }) => [
                  styles.removeStop,
                  {
                    borderColor: theme.palette.border,
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Trash2 color={theme.palette.danger} size={18} />
              </Pressable>
            </View>
          ))
        ) : (
          <AppText color="muted" variant="caption">
            لم تضف أي محطات بعد.
          </AppText>
        )}
      </AppCard>
      <AppCard style={styles.section}>
        <AppText variant="heading">4. معلومات الخط</AppText>
        <AppInput
          onChangeText={(nameAr) => store.setMeta({ nameAr })}
          placeholder="اسم الخط بالعربية"
          value={store.nameAr}
        />
        <AppInput
          onChangeText={(nameEn) => store.setMeta({ nameEn })}
          placeholder="English name"
          value={store.nameEn}
        />
        <AppInput
          keyboardType="number-pad"
          onChangeText={(price) => store.setMeta({ price })}
          placeholder="السعر بالليرة"
          value={store.price}
        />
        <AppInput
          multiline
          onChangeText={(notes) => store.setMeta({ notes })}
          placeholder="ملاحظات"
          value={store.notes}
        />
      </AppCard>
      {submit.isSuccess ? (
        <AppCard style={styles.success}>
          <CheckCircle2 color={theme.palette.success} size={24} />
          <AppText color="success">
            أرسلت المسودة رقم {store.submittedDraftId} للمراجعة بنجاح.
          </AppText>
        </AppCard>
      ) : null}
      {submit.isError ? (
        <AppText color="danger">تعذر إرسال المسودة. تحقق من البيانات وحاول مجدداً.</AppText>
      ) : null}
      <AppButton
        disabled={
          !store.nameAr.trim() ||
          !store.drawnLine ||
          store.drawnLine.length < 2 ||
          intersections.length > 0
        }
        loading={submit.isPending}
        onPress={() => submit.mutate()}
      >
        إرسال للمراجعة
      </AppButton>
      <AppButton
        icon={<Download color={theme.palette.foreground} size={18} />}
        onPress={() => void exportGeoJson()}
        variant="secondary"
      >
        مشاركة GeoJSON
      </AppButton>
      <AppButton
        icon={<RotateCcw color={theme.palette.foreground} size={18} />}
        onPress={() => {
          store.reset();
          submit.reset();
          setEditMode('line');
        }}
        variant="ghost"
      >
        بدء مسودة جديدة
      </AppButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  city: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  map: {
    height: 420,
    overflow: 'hidden',
  },
  modeButtons: {
    gap: 8,
  },
  removeStop: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  section: {
    gap: 10,
  },
  success: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stopInput: {
    flex: 1,
  },
  stopNumber: {
    minWidth: 22,
    textAlign: 'center',
  },
  stopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/studio/Index.tsx (1842 lines)
  confidence: high
  todos:      0
  notes:      Native map taps, line undo, stop authoring, conflict warnings, submission, and GeoJSON export preserve the studio workflow.
*/
