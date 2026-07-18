import { Bookmark, ExternalLink, Share2 } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import { googleMapsUrl, placeShareUrl } from '../model';
import { placesApi } from '../_lib/api';
import { invalidatePlaceQueries } from '../_lib/queries';

interface EngagementBarProps {
  initialSaved: boolean;
  initialSaves: number;
  lat: number;
  lng: number;
  placeId: number;
  placeName: string;
}

export function EngagementBar(props: EngagementBarProps) {
  const { login, user } = useAuth();
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{
    placeId: number;
    saved: boolean;
    saves: number;
  } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const saved = optimistic?.placeId === props.placeId
    ? optimistic.saved
    : props.initialSaved;
  const saves = optimistic?.placeId === props.placeId
    ? optimistic.saves
    : props.initialSaves;

  const toggleSave = async () => {
    if (!user) {
      await login();
      return;
    }
    const next = !saved;
    setOptimistic({
      placeId: props.placeId,
      saved: next,
      saves: saves + (next ? 1 : -1),
    });
    setSaveBusy(true);
    try {
      const result = next
        ? await placesApi.save(props.placeId)
        : await placesApi.unsave(props.placeId);
      setOptimistic({
        placeId: props.placeId,
        saved: result.saved,
        saves: result.saves_count,
      });
      await invalidatePlaceQueries(queryClient);
    } catch {
      setOptimistic(null);
    } finally {
      setSaveBusy(false);
    }
  };

  const share = async () => {
    const url = placeShareUrl(props.placeId);
    try {
      await Share.share({
        message: `${props.placeName}\n${url}`,
        title: props.placeName,
        url,
      });
    } catch {
      Alert.alert('تعذر فتح المشاركة', 'حاول مرة أخرى.');
    }
  };

  const openMap = async () => {
    const opened = await openSafeExternalUrl(
      googleMapsUrl({ lat: props.lat, lng: props.lng }),
    );
    if (!opened) {
      Alert.alert('تعذر فتح خرائط جوجل');
    }
  };

  return (
    <View style={styles.root}>
      <AppButton
        disabled={saveBusy}
        icon={
          <Bookmark
            color={theme.palette.foreground}
            fill={saved ? theme.palette.foreground : 'transparent'}
            size={17}
          />
        }
        onPress={() => void toggleSave()}
        variant={saved ? 'primary' : 'secondary'}
      >
        {saves}
      </AppButton>
      <AppButton
        icon={<Share2 color={theme.palette.foreground} size={17} />}
        onPress={() => void share()}
        variant="secondary"
      >
        مشاركة
      </AppButton>
      <AppButton
        icon={<ExternalLink color={theme.palette.foreground} size={17} />}
        onPress={() => void openMap()}
        variant="secondary"
      >
        افتح في خرائط جوجل
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/EngagementBar.tsx (114 lines)
  confidence: high
  todos:      0
  notes:      Native save, system sharing, map links, login, optimistic counts, and rollback preserve the source behavior.
*/
