import { Bookmark, Heart, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';

interface EngagementBarProps {
  commentsCount: number;
  initialLiked: boolean;
  initialLikes: number;
  initialSaved: boolean;
  initialSaves: number;
  placeId: number;
}

export function EngagementBar(props: EngagementBarProps) {
  const { login, user } = useAuth();
  const { theme } = useAppTheme();
  const [liked, setLiked] = useState(props.initialLiked);
  const [likes, setLikes] = useState(props.initialLikes);
  const [saved, setSaved] = useState(props.initialSaved);
  const [saves, setSaves] = useState(props.initialSaves);
  const [busy, setBusy] = useState<'like' | 'save' | null>(null);

  const toggleLike = async () => {
    if (!user) {
      await login();
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((value) => value + (next ? 1 : -1));
    setBusy('like');
    try {
      const result = next ? await placesApi.like(props.placeId) : await placesApi.unlike(props.placeId);
      setLiked(result.liked);
      setLikes(result.likes_count);
    } catch {
      setLiked(!next);
      setLikes((value) => value + (next ? -1 : 1));
    } finally {
      setBusy(null);
    }
  };

  const toggleSave = async () => {
    if (!user) {
      await login();
      return;
    }
    const next = !saved;
    setSaved(next);
    setSaves((value) => value + (next ? 1 : -1));
    setBusy('save');
    try {
      const result = next ? await placesApi.save(props.placeId) : await placesApi.unsave(props.placeId);
      setSaved(result.saved);
      setSaves(result.saves_count);
    } catch {
      setSaved(!next);
      setSaves((value) => value + (next ? -1 : 1));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <AppButton disabled={busy !== null} icon={<Heart color={theme.palette.foreground} fill={liked ? theme.palette.foreground : 'transparent'} size={17} />} onPress={() => void toggleLike()} variant={liked ? 'primary' : 'secondary'}>{likes}</AppButton>
      <AppButton disabled={busy !== null} icon={<Bookmark color={theme.palette.foreground} fill={saved ? theme.palette.foreground : 'transparent'} size={17} />} onPress={() => void toggleSave()} variant={saved ? 'primary' : 'secondary'}>{saves}</AppButton>
      <View style={styles.count}><MessageCircle color={theme.palette.mutedForeground} size={17} /><AppText color="muted">{props.commentsCount}</AppText></View>
    </View>
  );
}

const styles = StyleSheet.create({ count: { alignItems: 'center', flexDirection: 'row', gap: 5 }, root: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/EngagementBar.tsx (103 lines)
  confidence: high
  todos:      0
  notes:      Native auth and optimistic mutations preserve likes, saves, counts, and rollback.
*/
