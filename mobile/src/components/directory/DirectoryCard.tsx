import type { PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
} from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

interface DirectoryCardProps {
  accessibilityLabel?: string;
  actions?: ReactNode;
  badges?: readonly string[];
  compact?: boolean;
  media?: ReactNode;
  onPress?: () => void;
  subtitle?: string;
  textAlign?: TextStyle['textAlign'];
  title: string;
}

export function DirectoryCard({
  accessibilityLabel,
  actions,
  badges = [],
  children,
  compact = false,
  media,
  onPress,
  subtitle,
  textAlign,
  title,
}: PropsWithChildren<DirectoryCardProps>) {
  const { theme } = useAppTheme();
  const content = (
    <AppCard style={[styles.card, compact ? styles.compact : null]}>
      {media}
      <View style={styles.copy}>
        <AppText
          numberOfLines={compact ? 1 : 2}
          style={textAlign ? { textAlign } : undefined}
          variant="heading"
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            color="muted"
            numberOfLines={compact ? 1 : 3}
            style={textAlign ? { textAlign } : undefined}
          >
            {subtitle}
          </AppText>
        ) : null}
        {badges.length > 0 ? (
          <View style={styles.badges}>
            {badges.map((badge, index) => (
              <DirectoryBadge key={`${badge}-${index}`}>{badge}</DirectoryBadge>
            ))}
          </View>
        ) : null}
        {children}
      </View>
      {actions ? (
        <View
          style={[styles.actions, { borderTopColor: theme.palette.border }]}
        >
          {actions}
        </View>
      ) : null}
    </AppCard>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {content}
    </Pressable>
  );
}

export function DirectoryBadge({ children }: PropsWithChildren) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: theme.palette.surfaceRaised,
          borderColor: theme.palette.border,
        },
      ]}
    >
      <AppText color="muted" variant="caption">
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badges: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  card: {
    gap: 14,
    overflow: 'hidden',
  },
  compact: {
    padding: 12,
  },
  copy: {
    gap: 8,
  },
});
