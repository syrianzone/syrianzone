import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';
import { CATEGORIES } from '../_lib/categories';
import {
  validatePlaceSubmission,
  type PlacePhotoUpload,
} from '../_lib/submission';
import type { NearbyPlace, PlaceCategory } from '../_lib/types';
import { DuplicateSuggestions } from './DuplicateSuggestions';
import { PhotoPicker } from './PhotoPicker';

type SubmissionStep = 'auth' | 'checking' | 'done' | 'duplicates' | 'form';

export function SubmitSheet({
  latitude,
  longitude,
  onSelectExisting,
  onSubmitted,
}: {
  latitude: number;
  longitude: number;
  onSelectExisting: (id: number) => void;
  onSubmitted: (id: number) => void;
}) {
  const { loading: authLoading, login, user } = useAuth();
  const { theme } = useAppTheme();
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [photos, setPhotos] = useState<PlacePhotoUpload[]>([]);
  const [step, setStep] = useState<SubmissionStep>('checking');
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    if (!user) {
      return () => {
        active = false;
      };
    }

    void placesApi
      .nearby({
        include_pending: true,
        lat: latitude,
        lng: longitude,
        radius_km: 0.25,
      })
      .then((response) => {
        if (!active) {
          return;
        }
        setNearby(response.places);
        setStep(response.places.length > 0 ? 'duplicates' : 'form');
      })
      .catch(() => {
        if (active) {
          setStep('form');
        }
      });

    return () => {
      active = false;
    };
  }, [latitude, longitude, user]);

  const visibleStep: SubmissionStep = user ? step : 'auth';

  const submit = async () => {
    const validationError = validatePlaceSubmission({
      category,
      description,
      name,
      photos,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!category || submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response = await placesApi.submitPlace({
        category,
        description: description.trim(),
        lat: latitude,
        lng: longitude,
        name: name.trim(),
        photos,
      });
      setSubmittedId(response.id);
      setStep('done');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'تعذر إرسال المكان. حاول مرة أخرى.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppCard style={styles.root}>
      <AppText variant="heading">إضافة مكان جديد</AppText>
      <AppText color="muted">
        شارك مكاناً يستحق المشوار ليظهر على الخريطة بعد موافقة المشرفين.
      </AppText>

      {visibleStep === 'auth' ? (
        <View style={styles.section}>
          <AppText>سجل الدخول لتتمكن من إضافة الأماكن.</AppText>
          <AppButton
            loading={authLoading}
            onPress={() => void login()}
            variant="secondary"
          >
            تسجيل الدخول عبر Google
          </AppButton>
        </View>
      ) : null}

      {visibleStep === 'checking' ? (
        <AppText color="muted">جارٍ التحقق من الأماكن ضمن 250 متراً.</AppText>
      ) : null}

      {visibleStep === 'duplicates' ? (
        <DuplicateSuggestions
          onContinue={() => setStep('form')}
          onSelectExisting={onSelectExisting}
          places={nearby}
        />
      ) : null}

      {visibleStep === 'form' ? (
        <View style={styles.section}>
          {error ? <AppText color="danger">{error}</AppText> : null}
          <AppText variant="label">اسم المكان</AppText>
          <TextInput
            accessibilityLabel="اسم المكان"
            maxLength={160}
            onChangeText={setName}
            placeholder="مثال: مقهى النوفرة"
            placeholderTextColor={theme.palette.mutedForeground}
            style={[
              styles.input,
              {
                borderColor: theme.palette.border,
                color: theme.palette.foreground,
              },
            ]}
            value={name}
          />

          <AppText variant="label">التصنيف</AppText>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => (
              <View key={item.key} style={styles.category}>
                <AppButton
                  onPress={() => setCategory(item.key)}
                  variant={category === item.key ? 'primary' : 'ghost'}
                >
                  {item.label}
                </AppButton>
              </View>
            ))}
          </View>

          <AppText variant="label">الوصف</AppText>
          <TextInput
            accessibilityLabel="وصف المكان"
            maxLength={1000}
            multiline
            numberOfLines={5}
            onChangeText={setDescription}
            placeholder="صف المكان وما يميزه، 20 حرفاً على الأقل"
            placeholderTextColor={theme.palette.mutedForeground}
            style={[
              styles.input,
              styles.description,
              {
                borderColor: theme.palette.border,
                color: theme.palette.foreground,
              },
            ]}
            textAlignVertical="top"
            value={description}
          />
          <AppText color="muted" variant="caption">
            {description.length.toLocaleString('ar-SY')} / 1000
          </AppText>

          <AppText variant="label">الإحداثيات</AppText>
          <AppText color="muted">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </AppText>

          <AppText variant="label">الصور</AppText>
          <PhotoPicker onChange={setPhotos} photos={photos} />
          <AppButton
            loading={submitting}
            onPress={() => void submit()}
          >
            إرسال المكان
          </AppButton>
        </View>
      ) : null}

      {visibleStep === 'done' && submittedId !== null ? (
        <View style={styles.section}>
          <AppText>
            تم إرسال المكان، وسيظهر على الخريطة بعد موافقة المشرفين.
          </AppText>
          <AppButton onPress={() => onSubmitted(submittedId)}>إغلاق</AppButton>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  categories: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  category: {
    minWidth: '47%',
  },
  description: {
    minHeight: 120,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    textAlign: 'right',
  },
  root: {
    gap: 12,
  },
  section: {
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/SubmitSheet.tsx (294 lines)
  confidence: high
  todos:      0
  notes:      Native auth, automatic duplicate review, bounded fields, photos, submission, and completion preserve the full flow.
*/
