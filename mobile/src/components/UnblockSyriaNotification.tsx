import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';
import {
  preferenceKeys,
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

import { AppButton } from './ui/AppButton';
import { AppCard } from './ui/AppCard';
import { AppText } from './ui/AppText';

export const unblockSyriaContent = {
  buttonText: 'صوت الآن',
  description:
    'ساهم في فك الحظر عن الخدمات التقنية في سوريا. صوت للخدمات الأكثر أهمية بالنسبة لك لتكون من أولويات العمل.',
  dismissText: 'لاحقا',
  link: 'https://unblocksyria.com',
  title: 'صوتك بيعمل فرق!',
} as const;

const dismissalQueryKey = [
  'preference',
  preferenceKeys.dismissUnblockSyria,
] as const;

export default function UnblockSyriaNotification() {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const dismissal = useQuery({
    queryFn: () => readStringPreference(preferenceKeys.dismissUnblockSyria),
    queryKey: dismissalQueryKey,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (dismissal.data !== null) {
      return;
    }
    const timer = setTimeout(() => setVisible(true), 2_000);
    return () => clearTimeout(timer);
  }, [dismissal.data]);

  const dismiss = () => {
    setVisible(false);
    queryClient.setQueryData(dismissalQueryKey, 'true');
    void writeStringPreference(
      preferenceKeys.dismissUnblockSyria,
      'true',
    ).catch(() => {
      queryClient.setQueryData(dismissalQueryKey, null);
      setVisible(true);
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <AppCard style={styles.card}>
        <View style={styles.heading}>
          <AppText style={styles.flag}>🇸🇾</AppText>
          <AppText style={styles.copy} variant="heading">
            {unblockSyriaContent.title}
          </AppText>
          <Pressable
            accessibilityLabel="إغلاق"
            accessibilityRole="button"
            hitSlop={10}
            onPress={dismiss}
          >
            <X color={theme.palette.mutedForeground} size={18} />
          </Pressable>
        </View>
        <AppText color="muted" variant="caption">
          {unblockSyriaContent.description}
        </AppText>
        <View style={styles.actions}>
          <AppButton
            icon={<ExternalLink color={theme.palette.primaryForeground} size={16} />}
            onPress={() => void openSafeExternalUrl(unblockSyriaContent.link)}
          >
            {unblockSyriaContent.buttonText}
          </AppButton>
          <AppButton onPress={dismiss} variant="secondary">
            {unblockSyriaContent.dismissText}
          </AppButton>
        </View>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    elevation: 12,
    gap: 10,
    maxWidth: 360,
    shadowColor: '#000000',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  copy: {
    flex: 1,
  },
  flag: {
    fontSize: 24,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  overlay: {
    bottom: 16,
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/UnblockSyriaNotification.tsx (109 lines)
  confidence: high
  todos:      0
  notes:      The delayed native overlay preserves safe voting, persistent dismissal, and accessibility.
*/
