import { MapPin, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

export const GUIDE_LEVELS = [
  { level: 1, points: 0 },
  { level: 2, points: 15 },
  { level: 3, points: 75 },
  { level: 4, points: 250 },
  { level: 5, points: 500 },
  { level: 6, points: 1500 },
  { level: 7, points: 5000 },
  { level: 8, points: 15000 },
  { level: 9, points: 50000 },
  { level: 10, points: 100000 },
] as const;

export const RANK_NAMES: Readonly<Record<number, string>> = {
  1: 'مبتدئ',
  2: 'جوّال',
  3: 'مستطلع',
  4: 'مستكشف',
  5: 'مرشد محلي',
  6: 'مرشد خبير',
  7: 'رحّالة',
  8: 'رائد السياحة',
  9: 'سفير السياحة',
  10: 'وزير السياحة',
};

export function rankName(level: number): string {
  return RANK_NAMES[Math.min(Math.max(Math.trunc(level), 1), 10)]!;
}

export function nextRank(points: number): { level: number; points: number } | null {
  return GUIDE_LEVELS.find((item) => points < item.points) ?? null;
}

function tierColors(level: number, primary: string) {
  if (level >= 8) {
    return {
      backgroundColor: 'rgba(221, 75, 124, 0.12)',
      borderColor: 'rgba(221, 75, 124, 0.4)',
      color: '#dd4b7c',
      starColor: '#ffffff',
    };
  }
  if (level >= 6) {
    return {
      backgroundColor: 'rgba(230, 155, 25, 0.12)',
      borderColor: 'rgba(230, 155, 25, 0.4)',
      color: '#e69b19',
      starColor: '#492f04',
    };
  }
  return {
    backgroundColor: `${primary}1f`,
    borderColor: `${primary}66`,
    color: primary,
    starColor: '#ffffff',
  };
}

export function LevelBadge({
  level,
  showLabel = false,
}: {
  level: number;
  showLabel?: boolean;
}) {
  const { theme } = useAppTheme();
  if (!Number.isFinite(level) || level < 1) {
    return null;
  }
  const colors = tierColors(level, theme.palette.primary);
  const label = `${rankName(level)}، المستوى ${level}`;

  if (level < 3) {
    return (
      <View
        accessibilityLabel={label}
        accessibilityRole="image"
        style={[styles.number, { backgroundColor: theme.palette.surfaceRaised }]}
      >
        <AppText variant="caption">{level}</AppText>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      style={[
        styles.badge,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}
    >
      <MapPin color={colors.color} size={13} />
      {level >= 4 ? (
        <View style={styles.star}>
          <Star color={colors.color} fill={colors.color} size={15} />
          <AppText style={[styles.starNumber, { color: colors.starColor }]}>{level}</AppText>
        </View>
      ) : null}
      {showLabel ? <AppText style={{ color: colors.color }} variant="caption">{rankName(level)}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  number: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    flexDirection: 'row-reverse',
    gap: 4,
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: 6,
  },
  star: { alignItems: 'center', justifyContent: 'center' },
  starNumber: {
    fontSize: 8,
    lineHeight: 10,
    position: 'absolute',
    textAlign: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/LevelBadge.tsx (96 lines)
  confidence: high
  todos:      0
  notes:      Native named ranks, tier colors, pin and star progression preserve the guide-level badge.
*/
