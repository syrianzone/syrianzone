import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { ArrowRight, Check, Copy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { CATEGORY_LABELS } from '../_lib/categories';
import { placesApi } from '../_lib/api';
import { placeQueryKeys } from '../_lib/queries';
import { EngagementBar } from './EngagementBar';
import { LevelBadge } from './LevelBadge';
import { PhotoGallery } from './PhotoGallery';

const STATUS_LABELS = {
  pending: 'قيد المراجعة',
  rejected: 'مرفوض',
} as const;

export function PlaceDetailView({ onClose, placeId }: { onClose: () => void; placeId: number }) {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = useQuery({
    queryFn: () => placesApi.getPlace(placeId),
    queryKey: placeQueryKeys.detail(user?.id, placeId),
  });
  const place = query.data;

  useEffect(() => () => {
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
  }, []);

  const copyCoordinates = async () => {
    if (!place) {
      return;
    }
    await Clipboard.setStringAsync(`${place.lat}, ${place.lng}`);
    setCopied(true);
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.root}>
      <AppButton icon={<ArrowRight color={theme.palette.foreground} size={18} />} onPress={onClose} variant="ghost">رجوع</AppButton>
      {query.isError ? <QueryState detail="تعذر تحميل تفاصيل المكان." onRetry={() => void query.refetch()} type="error" /> : null}
      {!place && !query.isError ? <AppText color="muted">يتم تحميل تفاصيل المكان.</AppText> : null}
      {place ? (
        <>
          <PhotoGallery name={place.name} photos={place.photos} />
          <AppCard style={styles.copy}>
            <View style={styles.heading}>
              <AppText variant="heading">{place.name}</AppText>
              <AppText color="muted">{CATEGORY_LABELS[place.category]}</AppText>
            </View>
            <AppText>{place.description}</AppText>
            <View style={styles.contributor}>
              <Avatar label={place.user.name} uri={place.user.avatar_url} />
              <AppText color="muted">{place.user.name}</AppText>
              <LevelBadge level={place.user.level} showLabel />
            </View>
            <AppButton
              icon={copied ? <Check color={theme.palette.foreground} size={16} /> : <Copy color={theme.palette.foreground} size={16} />}
              onPress={() => void copyCoordinates()}
              variant="secondary"
            >
              {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
            </AppButton>
          </AppCard>
          {place.status === 'approved' ? (
            <EngagementBar
              initialSaved={place.saved_by_me}
              initialSaves={place.saves_count}
              lat={place.lat}
              lng={place.lng}
              placeId={place.id}
              placeName={place.name}
            />
          ) : (
            <AppText color={place.status === 'rejected' ? 'danger' : 'muted'} variant="label">
              {STATUS_LABELS[place.status]}
            </AppText>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contributor: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8 },
  copy: { gap: 10 },
  heading: { gap: 3 },
  root: { gap: 14 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlaceDetailView.tsx (123 lines)
  confidence: high
  todos:      0
  notes:      Native detail preserves gallery, contributor rank, coordinates, status, saves, sharing, and map links.
*/
