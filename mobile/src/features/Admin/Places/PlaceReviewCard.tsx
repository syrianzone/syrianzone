import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Check,
  ExternalLink,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { placesApi } from '@/features/Places/_lib/api';
import { CATEGORY_LABELS } from '@/features/Places/_lib/categories';
import {
  mergePickedPhotos,
  type PlacePhotoUpload,
} from '@/features/Places/_lib/submission';
import type {
  AdminPlace,
  PlacePhoto,
  PlaceStatus,
} from '@/features/Places/_lib/types';
import { googleMapsUrl } from '@/features/Places/model';
import { openSafeExternalUrl } from '@/lib/linking';

import { EditPlaceDialog } from './EditPlaceDialog';
import { RejectDialog } from './RejectDialog';

const STATUS_LABELS: Record<PlaceStatus, string> = {
  approved: 'مقبول',
  pending: 'قيد الانتظار',
  rejected: 'مرفوض',
};

async function pickPhoto(): Promise<PlacePhotoUpload | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('يلزم السماح بالوصول إلى الصور.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: false,
    mediaTypes: ['images'],
    quality: 0.9,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) {
    return null;
  }
  let fileSize = asset.fileSize;
  if (!fileSize) {
    try {
      fileSize = new File(asset.uri).size;
    } catch {
      fileSize = undefined;
    }
  }
  const merged = mergePickedPhotos([], [{ ...asset, fileSize }], 1);
  if (!merged.photos[0]) {
    Alert.alert('تعذر اختيار الصورة', merged.errors.join('\n'));
    return null;
  }
  return merged.photos[0];
}

function PhotoActions({
  busy,
  canDelete,
  onDelete,
  onReplace,
  onRotate,
  photo,
}: {
  busy: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onReplace: () => void;
  onRotate: () => void;
  photo: PlacePhoto;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.photo}>
      <Image source={photo.thumb_url} style={styles.photoImage} />
      <View style={styles.photoActions}>
        <AppButton
          disabled={busy}
          icon={<RotateCw color={theme.palette.foreground} size={16} />}
          onPress={onRotate}
          variant="secondary"
        >
          تدوير
        </AppButton>
        <AppButton
          disabled={busy}
          icon={<Upload color={theme.palette.foreground} size={16} />}
          onPress={onReplace}
          variant="secondary"
        >
          استبدال
        </AppButton>
        {canDelete ? (
          <AppButton
            disabled={busy}
            icon={<Trash2 color={theme.palette.primaryForeground} size={16} />}
            onPress={onDelete}
            variant="danger"
          >
            حذف
          </AppButton>
        ) : null}
      </View>
    </View>
  );
}

export function PlaceReviewCard({
  busy,
  onApprove,
  onChanged,
  onDelete,
  onReject,
  place,
}: {
  busy: boolean;
  onApprove: () => Promise<void>;
  onChanged: () => Promise<unknown>;
  onDelete: () => void;
  onReject: (reason: string | null) => Promise<void>;
  place: AdminPlace;
}) {
  const { theme } = useAppTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<number | 'add' | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const operationLock = useRef(false);
  const cardBusy = busy || actionBusy || photoBusy !== null;

  const runAction = async (operation: () => Promise<unknown>) => {
    if (busy || operationLock.current) {
      return;
    }
    operationLock.current = true;
    setActionBusy(true);
    try {
      await operation();
    } finally {
      operationLock.current = false;
      setActionBusy(false);
    }
  };

  const runPhoto = async (
    key: number | 'add',
    operation: () => Promise<boolean | unknown>,
  ) => {
    if (busy || operationLock.current) {
      return;
    }
    operationLock.current = true;
    setPhotoBusy(key);
    setPhotoError(null);
    try {
      const changed = await operation();
      if (changed !== false) {
        await onChanged();
      }
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'تعذر تعديل الصورة.');
    } finally {
      operationLock.current = false;
      setPhotoBusy(null);
    }
  };

  const addPhoto = async () => {
    await runPhoto('add', async () => {
      const photo = await pickPhoto();
      if (!photo) {
        return false;
      }
      await placesApi.adminAddPhoto(place.id, photo);
      return true;
    });
  };

  const replacePhoto = async (id: number) => {
    await runPhoto(id, async () => {
      const photo = await pickPhoto();
      if (!photo) {
        return false;
      }
      await placesApi.adminReplacePhoto(id, photo);
      return true;
    });
  };

  const deletePhoto = (id: number) => {
    Alert.alert('حذف هذه الصورة؟', undefined, [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => void runPhoto(id, () => placesApi.adminDeletePhoto(id)),
        style: 'destructive',
        text: 'حذف',
      },
    ]);
  };

  return (
    <AppCard style={styles.card}>
      <ScrollView contentContainerStyle={styles.photos} horizontal showsHorizontalScrollIndicator={false}>
        {place.photos.map((photo) => (
          <PhotoActions
            busy={cardBusy}
            canDelete={place.photos.length > 1}
            key={photo.id}
            onDelete={() => deletePhoto(photo.id)}
            onReplace={() => void replacePhoto(photo.id)}
            onRotate={() => void runPhoto(photo.id, () => placesApi.adminRotatePhoto(photo.id))}
            photo={photo}
          />
        ))}
        {place.photos.length < 10 ? (
          <AppButton
            disabled={cardBusy}
            icon={<Plus color={theme.palette.foreground} size={18} />}
            loading={photoBusy === 'add'}
            onPress={() => void addPhoto()}
            variant="secondary"
          >
            إضافة صورة
          </AppButton>
        ) : null}
      </ScrollView>
      {photoError ? <AppText color="danger">{photoError}</AppText> : null}
      <View style={styles.headingRow}>
        <View style={styles.grow}>
          <AppText variant="heading">{place.name}</AppText>
          <AppText color="muted" variant="caption">{CATEGORY_LABELS[place.category]}</AppText>
          <View style={styles.contributor}>
            {place.user.avatar_url ? (
              <Image accessibilityLabel={place.user.name} source={place.user.avatar_url} style={styles.avatar} />
            ) : null}
            <AppText color="muted" variant="caption">أضافه {place.user.name}</AppText>
          </View>
        </View>
        <AppText color={place.status === 'rejected' ? 'danger' : place.status === 'approved' ? 'success' : 'primary'} variant="label">
          {STATUS_LABELS[place.status]}
        </AppText>
      </View>
      <AppText>{place.description}</AppText>
      <AppButton
        disabled={cardBusy}
        icon={<ExternalLink color={theme.palette.foreground} size={16} />}
        onPress={() => void openSafeExternalUrl(googleMapsUrl(place))}
        variant="secondary"
      >
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </AppButton>
      <AppText color="muted" variant="caption">
        {new Date(place.created_at).toLocaleDateString('ar-SY')}
      </AppText>
      {place.status === 'rejected' && place.rejection_reason ? (
        <AppText color="danger">سبب الرفض: {place.rejection_reason}</AppText>
      ) : null}
      {place.status === 'pending' ? (
        <View style={styles.actions}>
          <AppButton
            disabled={cardBusy}
            icon={<Check color={theme.palette.primaryForeground} size={17} />}
            onPress={() => void runAction(onApprove)}
          >
            موافقة
          </AppButton>
          <AppButton
            disabled={cardBusy}
            icon={<X color={theme.palette.primaryForeground} size={17} />}
            onPress={() => {
              if (!operationLock.current) {
                setRejectOpen(true);
              }
            }}
            variant="danger"
          >
            رفض
          </AppButton>
        </View>
      ) : null}
      <View style={styles.actions}>
        <AppButton
          disabled={cardBusy}
          icon={<Pencil color={theme.palette.foreground} size={17} />}
          onPress={() => {
            if (!operationLock.current) {
              setEditOpen(true);
            }
          }}
          variant="secondary"
        >
          تعديل
        </AppButton>
        <AppButton
          disabled={cardBusy}
          icon={<Trash2 color={theme.palette.primaryForeground} size={17} />}
          onPress={() => {
            if (!operationLock.current) {
              onDelete();
            }
          }}
          variant="danger"
        >
          حذف نهائي
        </AppButton>
      </View>
      {rejectOpen ? (
        <RejectDialog
          busy={cardBusy}
          onConfirm={(reason) => void runAction(
            async () => {
              await onReject(reason);
              setRejectOpen(false);
            },
          )}
          onOpenChange={setRejectOpen}
          open
        />
      ) : null}
      {editOpen ? (
        <EditPlaceDialog
          onOpenChange={setEditOpen}
          onSaved={() => void onChanged()}
          open
          place={place}
        />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  avatar: { borderRadius: 10, height: 20, width: 20 },
  card: { gap: 12 },
  contributor: { alignItems: 'center', flexDirection: 'row-reverse', gap: 5 },
  grow: { flex: 1 },
  headingRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12 },
  photo: { gap: 6, width: 160 },
  photoActions: { gap: 5 },
  photoImage: { borderRadius: 12, height: 116, width: 160 },
  photos: { flexDirection: 'row-reverse', gap: 10 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Places/PlaceReviewCard.tsx (248 lines)
  confidence: high
  todos:      0
  notes:      Native review keeps photos, add, replace, rotate, delete, metadata, map link, edit, approve, reject, and delete.
*/
