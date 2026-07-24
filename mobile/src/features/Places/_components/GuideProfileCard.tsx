import { MapPin, X } from 'lucide-react-native';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { Guide, GuideFilter } from '../_lib/types';
import { LevelBadge, nextRank, rankName } from './LevelBadge';

export function GuideProfileCard({
  guide,
  onClose,
  onShowContributions,
}: {
  guide: Guide | null;
  onClose: () => void;
  onShowContributions: (guide: GuideFilter) => void;
}) {
  const { theme } = useAppTheme();
  if (!guide) {
    return null;
  }
  const next = nextRank(guide.points);
  const progress = next
    ? Math.min(100, Math.round((guide.points / next.points) * 100))
    : 100;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={[styles.overlay, { backgroundColor: theme.palette.overlay }]}>
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: theme.palette.background }]}
        >
          <Pressable
            accessibilityLabel="إغلاق ملف المرشد"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.close}
          >
            <X color={theme.palette.foreground} size={22} />
          </Pressable>
          <Avatar label={guide.name} size={80} uri={guide.avatar_url} />
          <View style={styles.identity}>
            <AppText variant="heading">{guide.name}</AppText>
            <LevelBadge level={guide.level} showLabel />
          </View>
          <View style={styles.points}>
            <AppText style={styles.pointsNumber} variant="title">{guide.points}</AppText>
            <AppText color="muted" variant="caption">نقطة</AppText>
          </View>
          <View style={styles.counts}>
            <Stat label="مساهمة" value={guide.approved_count} />
            <Stat label="حفظ" value={guide.saves_total} />
            <Stat label="آخر 30 يوماً" value={guide.recent_count} />
          </View>
          {next ? (
            <View style={styles.progressSection}>
              <View style={styles.progressLabels}>
                <AppText color="muted" variant="caption">{rankName(guide.level)}</AppText>
                <AppText color="muted" variant="caption">{rankName(next.level)} عند {next.points}</AppText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ max: 100, min: 0, now: progress }}
                style={[styles.progressTrack, { backgroundColor: theme.palette.surfaceRaised }]}
                testID="guide-progress"
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.palette.primary,
                      width: `${progress}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : (
            <AppText color="muted" variant="caption">أعلى رتبة، {rankName(guide.level)}</AppText>
          )}
          <AppButton
            icon={<MapPin color={theme.palette.primaryForeground} size={18} />}
            onPress={() => onShowContributions({ id: guide.user_id, name: guide.name })}
          >
            عرض المساهمات على الخريطة
          </AppButton>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.palette.surfaceRaised }]}>
      <AppText variant="label">{value}</AppText>
      <AppText color="muted" variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 22,
    gap: 13,
    maxWidth: 420,
    padding: 20,
    width: '88%',
  },
  close: { alignSelf: 'flex-start', padding: 6 },
  counts: { flexDirection: 'row-reverse', gap: 7, width: '100%' },
  identity: { alignItems: 'center', gap: 5 },
  overlay: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  points: { alignItems: 'baseline', flexDirection: 'row-reverse', gap: 5 },
  pointsNumber: { fontSize: 32, lineHeight: 40 },
  progressFill: { borderRadius: 4, height: '100%' },
  progressLabels: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  progressSection: { gap: 5, width: '100%' },
  progressTrack: { borderRadius: 4, height: 6, overflow: 'hidden' },
  stat: { alignItems: 'center', borderRadius: 10, flex: 1, padding: 8 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/GuideProfileCard.tsx (94 lines)
  confidence: high
  todos:      0
  notes:      Native profile modal preserves avatar fallback, rank, points, counts, progress, and contribution filtering.
*/
