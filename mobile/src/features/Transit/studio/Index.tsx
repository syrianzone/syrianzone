import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  CheckCircle2,
  Download,
  MapPin,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { TransitMapView } from '../_components/citymap/MapView';
import cities from '../_data/cities';
import { transitFallback } from '../_data/fallback';
import { useMapData } from '../_hooks/useMapData';
import { useStudioStore, type WizardStep } from '../_store/useStudioStore';
import type { City, MapDataResponse } from '../_types';
import {
  getPublishedRouteForEdit,
  getTransitStudioDraft,
  saveRouteDraft,
} from '../api';
import {
  appendCoordinate,
  buildTransitDraftGeoJson,
  hasPublishedRouteConflict,
  nearestSegmentInsertIndex,
  selfIntersections,
  undoCoordinate,
} from './model';

const emptyMapData: MapDataResponse = {
  routes: { features: [], type: 'FeatureCollection' },
  stops: { features: [], type: 'FeatureCollection' },
};

const studioCities = cities as unknown as readonly City[];

const stepLabels: readonly { label: string; step: WizardStep }[] = [
  { label: 'المدينة', step: 1 },
  { label: 'المسار', step: 2 },
  { label: 'المحطات', step: 3 },
  { label: 'التفاصيل', step: 4 },
  { label: 'المراجعة', step: 5 },
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function TransitStudioScreen() {
  const { theme } = useAppTheme();
  const { loading: authLoading, user } = useAuth();
  const params = useLocalSearchParams<{ edit?: string | string[] }>();
  const editParam = firstParam(params.edit);
  const accountId = user?.id ?? null;
  const store = useStudioStore();
  const requestedEditTarget =
    editParam !== undefined && editParam === store.dismissedEditTarget
      ? null
      : editParam ?? null;
  const isEditMode = store.isEditMode;
  const loadDraft = store.loadDraft;
  const setEditLoadFailed = store.setEditLoadFailed;
  const switchEditContext = store.switchEditContext;
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(
    null,
  );
  const editContextReady =
    store.editAccountId === accountId &&
    store.editTarget === requestedEditTarget;
  const editLoadError =
    requestedEditTarget !== null && editContextReady && store.editLoadFailed;
  const editLoading =
    authLoading ||
    !editContextReady ||
    (requestedEditTarget !== null && !isEditMode && !editLoadError);
  const cityId = store.cityId || 'damascus';
  const city =
    (studioCities.find((item) => item.id === cityId) ??
      studioCities.find((item) => item.status === 'active')) as City;
  const live = useMapData(cityId);
  const baseData = live.data ?? transitFallback(cityId) ?? emptyMapData;
  const intersections = selfIntersections(store.drawnLine ?? []);

  useEffect(() => {
    if (
      store.dismissedEditTarget !== null &&
      editParam !== store.dismissedEditTarget
    ) {
      store.clearDismissedEditTarget();
    }
  }, [editParam, store]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!editContextReady) {
      switchEditContext(accountId, requestedEditTarget);
      return;
    }
    if (!requestedEditTarget || isEditMode || editLoadError) {
      return;
    }
    let active = true;

    const load = async () => {
      try {
        const draft = /^\d+$/.test(requestedEditTarget)
          ? await getTransitStudioDraft(Number(requestedEditTarget))
          : await getPublishedRouteForEdit(requestedEditTarget);
        if (active) {
          loadDraft(draft);
        }
      } catch {
        if (active) {
          setEditLoadFailed(true);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [
    accountId,
    authLoading,
    editContextReady,
    editLoadError,
    isEditMode,
    loadDraft,
    requestedEditTarget,
    setEditLoadFailed,
    switchEditContext,
  ]);

  const mapData = useMemo<MapDataResponse>(() => {
    const draftRoutes =
      store.drawnLine && store.drawnLine.length >= 2
        ? [
            {
              geometry: {
                coordinates: store.drawnLine,
                type: 'LineString' as const,
              },
              properties: {
                colorIndex: 2,
                id: 'draft-preview',
                nameAr: store.nameAr || 'مسودة خط',
              },
              type: 'Feature' as const,
            },
          ]
        : [];
    const draftStops = store.stops.map((stop, index) => ({
      geometry: { coordinates: stop.coordinates, type: 'Point' as const },
      properties: {
        id: `draft-stop-${stop.id}`,
        nameAr: stop.nameAr || `محطة ${index + 1}`,
        routeIds: [] as string[],
      },
      type: 'Feature' as const,
    }));
    return {
      routes: {
        features: [...baseData.routes.features, ...draftRoutes],
        type: 'FeatureCollection',
      },
      stops: {
        features: [...baseData.stops.features, ...draftStops],
        type: 'FeatureCollection',
      },
    };
  }, [baseData, store.drawnLine, store.nameAr, store.stops]);

  const conflictWarning =
    store.drawnLine !== null &&
    hasPublishedRouteConflict(store.drawnLine, baseData.routes.features);

  const save = useMutation({
    mutationFn: () => {
      if (!store.drawnLine || store.drawnLine.length < 2) {
        throw new Error('A route needs at least two coordinates');
      }
      const parsedPrice = Number(store.price);
      return saveRouteDraft({
        cityId,
        coordinates: store.drawnLine,
        ...(store.editingDraftId === null
          ? {}
          : { draftId: store.editingDraftId }),
        nameAr: store.nameAr.trim(),
        ...(store.nameEn.trim() ? { nameEn: store.nameEn.trim() } : {}),
        ...(store.notes.trim() ? { notes: store.notes.trim() } : {}),
        ...(store.price.trim() && Number.isFinite(parsedPrice)
          ? { price: parsedPrice }
          : {}),
        ...(store.editingRouteId === null
          ? {}
          : { routeId: store.editingRouteId }),
        stops: store.stops,
      });
    },
    onSuccess: (draft) => store.setSubmittedDraftId(draft.id),
  });

  const resetDraft = () => {
    if (editParam !== undefined) {
      router.replace('/transit/studio');
    }
    store.beginNewDraft(accountId, editParam ?? null);
    save.reset();
    setSelectedVertexIndex(null);
  };

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

  const goToStep = (step: WizardStep) => {
    if (step <= store.step) {
      store.setStep(step);
      setSelectedVertexIndex(null);
    }
  };

  const routeMap = (
    <View style={styles.map}>
      <TransitMapView
        city={city}
        data={mapData}
        editableVertices={store.step === 2 ? store.drawnLine ?? undefined : undefined}
        onMapPress={(coordinate) => {
          if (store.step === 2) {
            if (store.drawnLine && store.drawnLine.length >= 2) {
              store.insertVertex(
                nearestSegmentInsertIndex(store.drawnLine, coordinate),
                coordinate,
              );
            } else {
              store.setDrawnLine(appendCoordinate(store.drawnLine, coordinate));
            }
          } else if (store.step === 3 && store.stops.length < 100) {
            store.addStop(coordinate);
          }
        }}
        onVertexChange={store.updateVertex}
        onVertexPress={setSelectedVertexIndex}
        selectedVertexIndex={selectedVertexIndex}
      />
    </View>
  );

  return (
    <Screen title="استوديو الترانزيت">
      <View accessibilityLabel="خطوات المساهمة" style={styles.steps}>
        {stepLabels.map((item) => (
          <Pressable
            accessibilityRole="button"
            disabled={item.step > store.step}
            key={item.step}
            onPress={() => goToStep(item.step)}
            style={[
              styles.step,
              {
                borderColor:
                  item.step === store.step
                    ? theme.palette.primary
                    : theme.palette.border,
                opacity: item.step > store.step ? 0.45 : 1,
              },
            ]}
          >
            <AppText
              color={item.step === store.step ? 'primary' : 'muted'}
              variant="caption"
            >
              {item.step}. {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {editLoading ? (
        <AppCard>
          <AppText color="muted">جار تحميل المسار للتعديل...</AppText>
        </AppCard>
      ) : null}
      {editLoadError ? (
        <AppCard style={{ borderColor: theme.palette.danger }}>
          <AppText color="danger">تعذر تحميل المسار للتعديل.</AppText>
        </AppCard>
      ) : null}

      {!editLoading && store.step === 1 ? (
        <AppCard style={styles.section}>
          <AppText variant="heading">1. اختر المدينة</AppText>
          <AppText color="muted">
            اختر المدينة التي تعرف مساراتها. ستظهر الخطوط المنشورة على الخريطة كمرجع.
          </AppText>
          <View style={styles.cityList}>
            {studioCities
              .filter((item) => item.status === 'active')
              .map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => {
                    if (item.id !== store.cityId) {
                      resetDraft();
                    }
                    store.setCity(item.id);
                    store.setStep(2);
                  }}
                  style={[
                    styles.city,
                    {
                      borderColor:
                        item.id === store.cityId
                          ? theme.palette.primary
                          : theme.palette.border,
                    },
                  ]}
                >
                  <AppText variant="label">{item.nameAr}</AppText>
                  <AppText color="muted" variant="caption">
                    {item.routeCount.toLocaleString('ar-SY')} مسار
                  </AppText>
                </Pressable>
              ))}
          </View>
        </AppCard>
      ) : null}

      {!editLoading && store.step === 2 ? (
        <AppCard style={styles.section}>
          <AppText variant="heading">2. ارسم المسار</AppText>
          <AppText color="muted">
            اضغط على الخريطة لإضافة النقاط. بعد رسم خط، اضغط قرب أي مقطع لإدراج نقطة جديدة، واسحب النقاط لتعديلها.
          </AppText>
          {routeMap}
          <AppText
            color={intersections.length ? 'danger' : 'muted'}
            variant="caption"
          >
            {store.drawnLine?.length ?? 0} نقطة
            {intersections.length
              ? `، يوجد ${intersections.length} تقاطع ذاتي`
              : ''}
          </AppText>
          {conflictWarning ? (
            <AppText color="danger" variant="caption">
              يبدو أن هناك مساراً منشوراً قريباً. راجع المسار قبل المتابعة.
            </AppText>
          ) : null}
          {selectedVertexIndex !== null ? (
            <AppButton
              disabled={(store.drawnLine?.length ?? 0) <= 2}
              icon={<Trash2 color={theme.palette.primaryForeground} size={18} />}
              onPress={() => {
                store.removeVertex(selectedVertexIndex);
                setSelectedVertexIndex(null);
              }}
              variant="danger"
            >
              حذف النقطة المحددة
            </AppButton>
          ) : null}
          <View style={styles.actions}>
            <AppButton
              disabled={!store.drawnLine}
              icon={<Undo2 color={theme.palette.foreground} size={18} />}
              onPress={() => {
                store.setDrawnLine(undoCoordinate(store.drawnLine));
                setSelectedVertexIndex(null);
              }}
              variant="secondary"
            >
              تراجع
            </AppButton>
            <AppButton
              disabled={
                !store.drawnLine ||
                store.drawnLine.length < 2 ||
                intersections.length > 0
              }
              onPress={() => store.setStep(3)}
            >
              التالي: المحطات
            </AppButton>
          </View>
        </AppCard>
      ) : null}

      {!editLoading && store.step === 3 ? (
        <AppCard style={styles.section}>
          <AppText variant="heading">3. أسماء المحطات</AppText>
          <AppText color="muted">
            اضغط على الخريطة لإضافة محطة. يمكنك ترك الاسم فارغاً لفريق المراجعة.
          </AppText>
          {routeMap}
          {store.stops.length ? (
            store.stops.map((stop, index) => (
              <View key={stop.id} style={styles.stopRow}>
                <AppText style={styles.stopNumber} variant="label">
                  {index + 1}
                </AppText>
                <AppInput
                  onChangeText={(nameAr) =>
                    store.updateStopName(stop.id, nameAr)
                  }
                  placeholder="اسم المحطة بالعربية"
                  style={styles.stopInput}
                  value={stop.nameAr}
                />
                <Pressable
                  accessibilityLabel={`حذف المحطة ${index + 1}`}
                  accessibilityRole="button"
                  onPress={() => store.removeStop(stop.id)}
                  style={[styles.removeStop, { borderColor: theme.palette.border }]}
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
          <View style={styles.actions}>
            <AppButton onPress={() => store.setStep(2)} variant="secondary">
              رجوع
            </AppButton>
            <AppButton onPress={() => store.setStep(4)}>
              التالي: معلومات الخط
            </AppButton>
          </View>
        </AppCard>
      ) : null}

      {!editLoading && store.step === 4 ? (
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
          <View style={styles.actions}>
            <AppButton onPress={() => store.setStep(3)} variant="secondary">
              رجوع
            </AppButton>
            <AppButton
              disabled={!store.nameAr.trim()}
              onPress={() => store.setStep(5)}
            >
              التالي: المراجعة
            </AppButton>
          </View>
        </AppCard>
      ) : null}

      {!editLoading && store.step === 5 ? (
        store.submittedDraftId === null ? (
          <AppCard style={styles.section}>
            <AppText variant="heading">5. مراجعة المسار</AppText>
            <AppText variant="heading">{store.nameAr}</AppText>
            {store.nameEn ? <AppText color="muted">{store.nameEn}</AppText> : null}
            <AppText>المدينة: {city.nameAr}</AppText>
            <AppText>
              نقاط المسار: {store.drawnLine?.length ?? 0}، المحطات: {store.stops.length}
            </AppText>
            {store.price ? <AppText>التعرفة: {store.price} ل.س</AppText> : null}
            {store.notes ? <AppText color="muted">{store.notes}</AppText> : null}
            {save.isError ? (
              <AppText color="danger">
                تعذر حفظ المسودة. تحقق من البيانات وحاول مجدداً.
              </AppText>
            ) : null}
            <AppButton
              disabled={
                !store.nameAr.trim() ||
                !store.drawnLine ||
                store.drawnLine.length < 2 ||
                intersections.length > 0
              }
              loading={save.isPending}
              onPress={() => save.mutate()}
            >
              {store.isEditMode ? 'حفظ التعديلات' : 'إرسال للمراجعة'}
            </AppButton>
            <AppButton
              icon={<MapPin color={theme.palette.foreground} size={18} />}
              onPress={() => store.setStep(2)}
              variant="secondary"
            >
              تعديل المسار
            </AppButton>
            <AppButton
              icon={<Download color={theme.palette.foreground} size={18} />}
              onPress={() => void exportGeoJson()}
              variant="secondary"
            >
              مشاركة GeoJSON
            </AppButton>
            <AppButton onPress={() => store.setStep(4)} variant="ghost">
              رجوع إلى التفاصيل
            </AppButton>
          </AppCard>
        ) : (
          <AppCard style={styles.success}>
            <CheckCircle2 color={theme.palette.success} size={28} />
            <AppText color="success" variant="heading">
              {store.isEditMode
                ? 'تم إرسال تعديلات المسار بنجاح.'
                : 'تم إرسال المسار بنجاح.'}
            </AppText>
            <AppText color="muted">
              رقم المساهمة: {store.submittedDraftId}
            </AppText>
            <AppButton
              icon={<RotateCcw color={theme.palette.foreground} size={18} />}
              onPress={resetDraft}
              variant="secondary"
            >
              بدء مسودة جديدة
            </AppButton>
          </AppCard>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  city: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityList: {
    gap: 8,
  },
  map: {
    height: 420,
    overflow: 'hidden',
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
  step: {
    borderBottomWidth: 2,
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  steps: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
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
  success: {
    alignItems: 'center',
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/studio/Index.tsx (1842 lines)
  confidence: high
  todos:      0
  notes:      Five-step native authoring includes draft reopening, published-route edits, draggable vertices, stop authoring, review, submission, and export.
*/
