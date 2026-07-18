import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Plus, RotateCw, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { ownerDetailsPatch, validateOwnerLocation } from '../ownerManagement';
import { placesApi } from '../_lib/api';
import { CATEGORIES } from '../_lib/categories';
import {
  MAX_PLACE_PHOTOS,
  mergePickedPhotos,
  type PickedPhotoCandidate,
} from '../_lib/submission';
import type {
  MyPlace,
  PlaceCategory,
  PlaceDetail,
  PlacePhoto,
  PlaceStatus,
} from '../_lib/types';

const STATUS_LABELS: Record<PlaceStatus, string> = {
  approved: 'مقبول',
  pending: 'قيد المراجعة',
  rejected: 'مرفوض',
};

function knownSize(asset: ImagePicker.ImagePickerAsset): PickedPhotoCandidate {
  if (asset.fileSize) {
    return asset;
  }
  try {
    return { ...asset, fileSize: new File(asset.uri).size };
  } catch {
    return asset;
  }
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function ManagePlaceDialog({
  onClose,
  onUpdated,
  place,
}: {
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
  place: MyPlace;
}) {
  const { theme } = useAppTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [category, setCategory] = useState<PlaceCategory>(place.category);
  const [coords, setCoords] = useState(`${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`);
  const [description, setDescription] = useState(place.description);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [locationDone, setLocationDone] = useState(false);
  const [detailsDone, setDetailsDone] = useState(false);
  const [name, setName] = useState(place.name);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [status, setStatus] = useState<PlaceStatus>(place.status);

  const load = () => {
    setDetail(null);
    setLoadFailed(false);
    setError(null);
    void placesApi.getPlace(place.id)
      .then((value) => {
        setDetail(value);
        setCategory(value.category);
        setDescription(value.description);
        setName(value.name);
        setPhotos(value.photos);
        setStatus(value.status);
      })
      .catch(() => setLoadFailed(true));
  };

  useEffect(() => {
    let active = true;
    void placesApi.getPlace(place.id)
      .then((value) => {
        if (!active) {
          return;
        }
        setDetail(value);
        setCategory(value.category);
        setDescription(value.description);
        setName(value.name);
        setPhotos(value.photos);
        setStatus(value.status);
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [place.id]);

  const notifyPending = () => {
    setStatus('pending');
    void onUpdated();
  };

  const saveDetails = async () => {
    if (!detail || busy) {
      return;
    }
    const patch = ownerDetailsPatch(detail, { category, description, name });
    if (typeof patch === 'string') {
      setError(patch);
      return;
    }
    if (Object.keys(patch).length === 0) {
      setError('لا توجد تعديلات.');
      return;
    }
    setBusy('details');
    setDetailsDone(false);
    setError(null);
    try {
      const updated = await placesApi.updateMyPlace(place.id, patch);
      setDetail((current) => current ? {
        ...current,
        category: updated.category,
        description: updated.description,
        name: updated.name,
        status: 'pending',
      } : current);
      setDetailsDone(true);
      notifyPending();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذر حفظ التعديلات.'));
    } finally {
      setBusy(null);
    }
  };

  const saveLocation = async () => {
    if (busy) {
      return;
    }
    const point = validateOwnerLocation(coords);
    if (typeof point === 'string') {
      setError(point);
      return;
    }
    setBusy('location');
    setLocationDone(false);
    setError(null);
    try {
      await placesApi.updateMyPlaceLocation(place.id, point);
      setLocationDone(true);
      notifyPending();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذر تحديث الموقع.'));
    } finally {
      setBusy(null);
    }
  };

  const rotatePhoto = async (photo: PlacePhoto) => {
    if (busy) {
      return;
    }
    setBusy(`rotate:${photo.id}`);
    setError(null);
    try {
      const updated = await placesApi.rotateMyPhoto(photo.id);
      setPhotos((current) => current.map((item) => item.id === photo.id ? {
        ...item,
        display_url: updated.display_url,
        thumb_url: updated.thumb_url,
      } : item));
      void onUpdated();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذر تدوير الصورة.'));
    } finally {
      setBusy(null);
    }
  };

  const deletePhoto = (photo: PlacePhoto) => {
    if (busy || photos.length <= 1) {
      return;
    }
    Alert.alert('حذف هذه الصورة؟', 'سيعود المكان إلى قائمة المراجعة.', [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => {
          setBusy(`delete-photo:${photo.id}`);
          setError(null);
          void placesApi.deleteMyPhoto(photo.id)
            .then(() => {
              setPhotos((current) => current.filter((item) => item.id !== photo.id));
              notifyPending();
            })
            .catch((cause: unknown) => setError(errorMessage(cause, 'تعذر حذف الصورة.')))
            .finally(() => setBusy(null));
        },
        style: 'destructive',
        text: 'حذف',
      },
    ]);
  };

  const addPhoto = async () => {
    if (busy || photos.length >= MAX_PLACE_PHOTOS) {
      return;
    }
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('يلزم السماح بالوصول إلى الصور لاختيار صورة المكان.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) {
      return;
    }
    const selected = mergePickedPhotos([], [knownSize(asset)], 1);
    if (!selected.photos[0]) {
      setError(selected.errors.join('، ') || 'تعذر قراءة الصورة.');
      return;
    }
    setBusy('add-photo');
    try {
      const added = await placesApi.addMyPhoto(place.id, selected.photos[0]);
      setPhotos((current) => [...current, {
        display_url: added.display_url,
        id: added.id,
        sort: added.sort,
        thumb_url: added.thumb_url,
      }]);
      notifyPending();
    } catch (cause) {
      setError(errorMessage(cause, 'تعذر إضافة الصورة.'));
    } finally {
      setBusy(null);
    }
  };

  const deletePlace = () => {
    if (busy) {
      return;
    }
    Alert.alert('حذف المكان نهائياً؟', 'سيتم حذف المكان وصوره نهائياً.', [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => {
          setBusy('delete-place');
          setError(null);
          void placesApi.deleteMyPlace(place.id)
            .then(() => {
              void onUpdated();
              onClose();
            })
            .catch((cause: unknown) => setError(errorMessage(cause, 'تعذر حذف المكان.')))
            .finally(() => setBusy(null));
        },
        style: 'destructive',
        text: 'حذف المكان',
      },
    ]);
  };

  return (
    <AppCard style={styles.root}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <AppText variant="heading">إدارة المكان</AppText>
          <AppText color={status === 'rejected' ? 'danger' : 'muted'}>
            {STATUS_LABELS[status]}
          </AppText>
        </View>
        <Pressable accessibilityLabel="إغلاق إدارة المكان" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
          <X color={theme.palette.foreground} size={22} />
        </Pressable>
      </View>

      {loadFailed ? (
        <View style={styles.section}>
          <AppText color="danger">تعذر تحميل بيانات المكان.</AppText>
          <AppButton onPress={load} variant="secondary">إعادة المحاولة</AppButton>
        </View>
      ) : !detail ? (
        <AppText color="muted">جارٍ تحميل بيانات المكان...</AppText>
      ) : (
        <>
          {error ? <AppText color="danger">{error}</AppText> : null}
          <View style={styles.section}>
            <AppText variant="label">اسم المكان</AppText>
            <AppInput editable={!busy} maxLength={160} onChangeText={setName} value={name} />
            <AppText variant="label">التصنيف</AppText>
            <View style={styles.categories}>
              {CATEGORIES.map((item) => (
                <AppButton
                  disabled={Boolean(busy)}
                  key={item.key}
                  onPress={() => setCategory(item.key)}
                  variant={category === item.key ? 'primary' : 'secondary'}
                >
                  {item.label}
                </AppButton>
              ))}
            </View>
            <AppText variant="label">الوصف</AppText>
            <AppInput
              editable={!busy}
              maxLength={1000}
              multiline
              numberOfLines={4}
              onChangeText={setDescription}
              value={description}
            />
            <AppText color="muted" variant="caption">{description.length} / 1000</AppText>
            {detailsDone ? <AppText>تم الحفظ وستظهر التعديلات بعد موافقة المشرفين</AppText> : null}
            <AppButton loading={busy === 'details'} onPress={() => void saveDetails()}>
              حفظ التعديلات
            </AppButton>
          </View>

          <View style={styles.section}>
            <AppText variant="label">الصور</AppText>
            <View style={styles.photos}>
              {photos.map((photo) => (
                <View key={photo.id} style={[styles.photo, { borderColor: theme.palette.border }]}>
                  <Image accessibilityLabel={`${place.name} صورة`} contentFit="cover" source={photo.thumb_url} style={styles.photoImage} />
                  <View style={styles.photoActions}>
                    <Pressable
                      accessibilityLabel="تدوير الصورة"
                      accessibilityRole="button"
                      disabled={Boolean(busy)}
                      onPress={() => void rotatePhoto(photo)}
                      style={styles.photoButton}
                    >
                      <RotateCw color="#ffffff" size={17} />
                    </Pressable>
                    {photos.length > 1 ? (
                      <Pressable
                        accessibilityLabel="حذف الصورة"
                        accessibilityRole="button"
                        disabled={Boolean(busy)}
                        onPress={() => deletePhoto(photo)}
                        style={styles.photoButton}
                      >
                        <Trash2 color="#ffffff" size={17} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            {photos.length < MAX_PLACE_PHOTOS ? (
              <AppButton
                disabled={Boolean(busy)}
                icon={<Plus color={theme.palette.foreground} size={18} />}
                loading={busy === 'add-photo'}
                onPress={() => void addPhoto()}
                variant="secondary"
              >
                إضافة صورة
              </AppButton>
            ) : null}
            <AppText color="muted" variant="caption">الحد الأقصى 10 صور، 12 MB لكل صورة.</AppText>
          </View>

          <View style={styles.section}>
            <AppText variant="label">الإحداثيات الجديدة</AppText>
            <AppInput
              accessibilityLabel="الإحداثيات الجديدة"
              editable={!busy}
              onChangeText={setCoords}
              style={styles.coordinates}
              value={coords}
            />
            {locationDone ? <AppText>تم تحديث الموقع وسيظهر التعديل بعد موافقة المشرفين</AppText> : null}
            <AppButton loading={busy === 'location'} onPress={() => void saveLocation()}>
              حفظ الموقع
            </AppButton>
          </View>

          <AppButton
            disabled={Boolean(busy)}
            icon={<Trash2 color={theme.palette.primaryForeground} size={18} />}
            loading={busy === 'delete-place'}
            onPress={deletePlace}
            variant="danger"
          >
            حذف المكان
          </AppButton>
        </>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  coordinates: { textAlign: 'left' },
  grow: { flex: 1, gap: 3 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8 },
  iconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  photo: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative', width: '31%' },
  photoActions: { bottom: 5, flexDirection: 'row-reverse', gap: 5, left: 5, position: 'absolute' },
  photoButton: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 16, height: 30, justifyContent: 'center', width: 30 },
  photoImage: { height: 104, width: '100%' },
  photos: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  root: { gap: 14 },
  section: { gap: 9 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/ManagePlaceDialog.tsx (503 lines)
  confidence: high
  todos:      0
  notes:      Native owner details, photo, pin, moderation, retry, and deletion controls preserve the management flow.
*/
