import { LogIn, LogOut, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import UserNav from '@/components/UserNav';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import type { AuthErrorCode } from '@/lib/auth/errors';

interface AuthScreenProps {
  onOpenDashboard?: () => void;
  onOpenPolls?: () => void;
  onOpenProfile?: () => void;
}

const copy = {
  ar: {
    account: 'الحساب',
    admin: 'حساب إداري موثّق',
    errors: {
      access_denied: 'هذا الحساب غير مخوّل بالدخول.',
      auth_failed: 'لم يكتمل تسجيل الدخول عبر جوجل.',
      default: 'تعذر إكمال تسجيل الدخول بأمان. حاول مرة أخرى.',
    },
    signedOut: 'سجّل الدخول للوصول إلى حسابك وأدوات الإدارة.',
  },
  en: {
    account: 'Account',
    admin: 'Verified admin account',
    errors: {
      access_denied: 'This account is not allowed to sign in.',
      auth_failed: 'Google sign-in was not completed.',
      default: 'Secure sign-in could not be completed. Try again.',
    },
    signedOut: 'Sign in to access your account and administration tools.',
  },
} as const;

function safeErrorMessage(code: AuthErrorCode, locale: 'ar' | 'en'): string {
  if (code === 'access_denied' || code === 'auth_failed') {
    return copy[locale].errors[code];
  }
  return copy[locale].errors.default;
}

export function AuthScreen({
  onOpenDashboard,
  onOpenPolls,
  onOpenProfile,
}: AuthScreenProps) {
  const { error, isAdmin, loading, login, logout, user } = useAuth();
  const { locale, t } = useLocale();
  const { theme } = useAppTheme();

  if (loading && !user) {
    return (
      <Screen scroll={false}>
        <View style={styles.loading} testID="auth-loading">
          <ActivityIndicator color={theme.palette.primary} size="large" />
          <AppText color="muted">{t('loading')}</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={copy[locale].account}>
      {error ? (
        <AppCard testID="auth-error">
          <AppText color="danger">{safeErrorMessage(error, locale)}</AppText>
        </AppCard>
      ) : null}

      {user ? (
        <AppCard style={styles.account} testID="auth-account">
          <View style={styles.accountHeader}>
            <View style={styles.identity}>
              <AppText variant="heading">{user.name}</AppText>
              <AppText color="muted">{user.email}</AppText>
            </View>
            <UserNav
              onOpenDashboard={onOpenDashboard}
              onOpenPolls={onOpenPolls}
              onOpenProfile={onOpenProfile}
            />
          </View>
          {isAdmin ? (
            <View style={styles.role}>
              <ShieldCheck color={theme.palette.success} size={20} />
              <AppText color="success" variant="label">
                {copy[locale].admin}
              </AppText>
            </View>
          ) : null}
          <AppButton
            icon={<LogOut color={theme.palette.primaryForeground} size={18} />}
            loading={loading}
            onPress={() => void logout()}
            testID="auth-sign-out"
            variant="danger"
          >
            {t('signOut')}
          </AppButton>
        </AppCard>
      ) : (
        <AppCard style={styles.signedOut}>
          <AppText color="muted">{copy[locale].signedOut}</AppText>
          <AppButton
            icon={<LogIn color={theme.palette.primaryForeground} size={18} />}
            loading={loading}
            onPress={() => void login()}
            testID="auth-sign-in"
          >
            {t('signIn')}
          </AppButton>
        </AppCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: {
    gap: 20,
  },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  identity: {
    flex: 1,
    gap: 4,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  role: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  signedOut: {
    gap: 20,
  },
});
