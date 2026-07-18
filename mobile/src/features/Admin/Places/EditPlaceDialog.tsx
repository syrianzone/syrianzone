import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { placesApi } from '@/features/Places/_lib/api';
import { CATEGORIES } from '@/features/Places/_lib/categories';
import type {
  AdminPlace,
  PlaceCategory,
} from '@/features/Places/_lib/types';

import { validatePlaceEdit } from './model';

export function EditPlaceDialog({
  onOpenChange,
  onSaved,
  open,
  place,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (place: AdminPlace) => void;
  open: boolean;
  place: AdminPlace;
}) {
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<PlaceCategory>(place.category);
  const [description, setDescription] = useState(place.description);
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState(String(place.lat));
  const [lng, setLng] = useState(String(place.lng));
  const [name, setName] = useState(place.name);

  if (!open) {
    return null;
  }

  const save = async () => {
    const validated = validatePlaceEdit({ category, description, lat, lng, name });
    if (typeof validated === 'string') {
      setError(validated);
      return;
    }
    const changed: Partial<typeof validated> = {};
    if (validated.name !== place.name) {
      changed.name = validated.name;
    }
    if (validated.category !== place.category) {
      changed.category = validated.category;
    }
    if (validated.description !== place.description) {
      changed.description = validated.description;
    }
    if (validated.lat !== place.lat) {
      changed.lat = validated.lat;
    }
    if (validated.lng !== place.lng) {
      changed.lng = validated.lng;
    }
    if (Object.keys(changed).length === 0) {
      onOpenChange(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await placesApi.adminUpdatePlace(place.id, changed);
      onSaved(updated);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ التعديلات.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppCard style={styles.root}>
      <AppText variant="heading">تعديل المكان</AppText>
      {error ? <AppText color="danger">{error}</AppText> : null}
      <AppText variant="label">الاسم</AppText>
      <AppInput editable={!busy} maxLength={160} onChangeText={setName} value={name} />
      <AppText variant="label">التصنيف</AppText>
      <View style={styles.categories}>
        {CATEGORIES.map((item) => (
          <AppButton
            disabled={busy}
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
      <View style={styles.coordinates}>
        <View style={styles.coordinate}>
          <AppText variant="label">خط العرض</AppText>
          <AppInput editable={!busy} keyboardType="decimal-pad" onChangeText={setLat} style={styles.number} value={lat} />
        </View>
        <View style={styles.coordinate}>
          <AppText variant="label">خط الطول</AppText>
          <AppInput editable={!busy} keyboardType="decimal-pad" onChangeText={setLng} style={styles.number} value={lng} />
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton disabled={busy} onPress={() => onOpenChange(false)} variant="secondary">إلغاء</AppButton>
        <AppButton loading={busy} onPress={() => void save()}>حفظ</AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  categories: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  coordinate: { flex: 1, gap: 5 },
  coordinates: { flexDirection: 'row-reverse', gap: 8 },
  number: { textAlign: 'left' },
  root: { gap: 9 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Places/EditPlaceDialog.tsx (191 lines)
  confidence: high
  todos:      0
  notes:      Native editing keeps every field, source limits, Syria bounds, changed-field payloads, and guarded saving.
*/
