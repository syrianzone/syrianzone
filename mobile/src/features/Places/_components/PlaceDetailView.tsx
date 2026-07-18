import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { ArrowRight, Copy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { useAppTheme } from '@/contexts/ThemeContext';

import { CATEGORY_LABELS } from '../_lib/categories';
import { placesApi } from '../_lib/api';
import { CommentsSection } from './CommentsSection';
import { EngagementBar } from './EngagementBar';
import { PhotoGallery } from './PhotoGallery';
import { ReportButton } from './ReportButton';

export function PlaceDetailView({ onClose, placeId }: { onClose: () => void; placeId: number }) {
  const { theme } = useAppTheme();
  const query = useQuery({ queryFn: () => placesApi.getPlace(placeId), queryKey: ['places', 'detail', placeId] });
  const place = query.data;
  return (
    <View style={styles.root}>
      <AppButton icon={<ArrowRight color={theme.palette.foreground} size={18} />} onPress={onClose} variant="ghost">رجوع</AppButton>
      {query.isError ? <QueryState detail="تعذر تحميل تفاصيل المكان." onRetry={() => void query.refetch()} type="error" /> : null}
      {!place && !query.isError ? <AppText color="muted">يتم تحميل تفاصيل المكان.</AppText> : null}
      {place ? (
        <>
          <PhotoGallery name={place.name} photos={place.photos} />
          <AppCard style={styles.copy}>
            <AppText variant="heading">{place.name}</AppText>
            <AppText color="muted">{CATEGORY_LABELS[place.category]}</AppText>
            <AppText>{place.description}</AppText>
            <AppText color="muted">أضافه {place.user.name}</AppText>
            <AppButton icon={<Copy color={theme.palette.foreground} size={16} />} onPress={() => void Clipboard.setStringAsync(`${place.lat}, ${place.lng}`)} variant="secondary">{place.lat.toFixed(5)}, {place.lng.toFixed(5)}</AppButton>
          </AppCard>
          <EngagementBar commentsCount={place.comments_count} initialLiked={place.liked_by_me} initialLikes={place.likes_count} initialSaved={place.saved_by_me} initialSaves={place.saves_count} placeId={place.id} />
          <ReportButton placeId={place.id} />
          <CommentsSection placeId={place.id} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ copy: { gap: 8 }, root: { gap: 14 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlaceDetailView.tsx (122 lines)
  confidence: high
  todos:      0
  notes:      Native detail preserves gallery, attribution, coordinates, engagement, reports, and comments.
*/
