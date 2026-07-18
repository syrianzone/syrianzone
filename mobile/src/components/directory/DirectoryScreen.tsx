import { AlertTriangle } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';

interface DirectoryScreenProps {
  cachedWarning?: string;
  direction?: 'ltr' | 'rtl';
  empty?: boolean;
  emptyDetail?: string;
  emptyReloadLabel?: string;
  emptyTitle?: string;
  errorDetail?: string;
  errorTitle?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  onRetry?: () => void;
  refreshing?: boolean;
  retryLabel?: string;
  subtitle: string;
  textAlign?: 'left' | 'right';
  title: string;
  trailing?: ReactNode;
}

export function DirectoryScreen({
  cachedWarning,
  children,
  direction,
  empty = false,
  emptyDetail,
  emptyReloadLabel = 'إعادة التحميل',
  emptyTitle,
  errorDetail,
  errorTitle = 'تعذر تحميل البيانات',
  isLoading = false,
  loadingLabel = 'جاري التحميل...',
  onRetry,
  refreshing = false,
  retryLabel = 'إعادة المحاولة',
  subtitle,
  textAlign,
  title,
  trailing,
}: PropsWithChildren<DirectoryScreenProps>) {
  const { theme } = useAppTheme();

  return (
    <Screen
      onRefresh={onRetry}
      refreshing={refreshing}
      subtitle={textAlign ? undefined : subtitle}
      title={textAlign ? undefined : title}
      trailing={textAlign ? undefined : trailing}
    >
      <View style={[styles.body, direction ? { direction } : null]}>
      {textAlign ? (
        <View style={styles.customHeading}>
          <View style={styles.customHeadingCopy}>
            <AppText style={{ textAlign }} variant="title">
              {title}
            </AppText>
            <AppText color="muted" style={{ textAlign }}>
              {subtitle}
            </AppText>
          </View>
          {trailing}
        </View>
      ) : null}
      {cachedWarning ? (
        <AppCard style={styles.warningCard}>
          <View style={styles.warningCopy}>
            <AlertTriangle color={theme.palette.danger} size={20} />
            <AppText color="danger" style={styles.warningText}>
              {cachedWarning}
            </AppText>
          </View>
          {onRetry ? (
            <AppButton onPress={onRetry} variant="ghost">
              {retryLabel}
            </AppButton>
          ) : null}
        </AppCard>
      ) : null}

      {isLoading ? (
        <View accessibilityLabel={loadingLabel} style={styles.state}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
          <AppText color="muted">{loadingLabel}</AppText>
        </View>
      ) : errorDetail ? (
        <View style={styles.state}>
          <AlertTriangle color={theme.palette.danger} size={34} />
          <AppText variant="heading">{errorTitle}</AppText>
          <AppText color="muted">{errorDetail}</AppText>
          {onRetry ? (
            <AppButton onPress={onRetry} variant="secondary">
              {retryLabel}
            </AppButton>
          ) : null}
        </View>
      ) : empty ? (
        <View style={styles.state}>
          <AppText variant="heading">{emptyTitle ?? 'لا توجد نتائج'}</AppText>
          {emptyDetail ? <AppText color="muted">{emptyDetail}</AppText> : null}
          {onRetry ? (
            <AppButton onPress={onRetry} variant="secondary">
              {emptyReloadLabel}
            </AppButton>
          ) : null}
        </View>
      ) : (
        children
      )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16,
    width: '100%',
  },
  customHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  customHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  state: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 260,
    padding: 24,
  },
  warningCard: {
    gap: 10,
    paddingVertical: 10,
  },
  warningCopy: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  warningText: {
    flex: 1,
  },
});
