import { AlertCircle, Inbox, RotateCcw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { AppButton } from './AppButton';
import { AppText } from './AppText';

interface QueryStateProps {
  detail?: string;
  onRetry?: () => void;
  type: 'empty' | 'error';
}

export function QueryState({ detail, onRetry, type }: QueryStateProps) {
  const { t } = useLocale();
  const { theme } = useAppTheme();
  const Icon = type === 'error' ? AlertCircle : Inbox;

  return (
    <View style={styles.container}>
      <Icon color={theme.palette.mutedForeground} size={34} />
      <AppText variant="heading">{type === 'error' ? t('error') : t('empty')}</AppText>
      {detail ? <AppText color="muted">{detail}</AppText> : null}
      {onRetry ? (
        <AppButton
          icon={<RotateCcw color={theme.palette.foreground} size={18} />}
          onPress={onRetry}
          variant="secondary"
        >
          {t('retry')}
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 220,
    padding: 24,
  },
});
