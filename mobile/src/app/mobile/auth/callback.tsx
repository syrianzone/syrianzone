import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/auth/api';
import { completeAuthCallback } from '@/lib/auth/callback';
import { nativePendingAuthStore } from '@/lib/auth/pending';
import { tokenStorage } from '@/lib/storage/secure';

function first(value: string | string[] | undefined): string | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected ?? null;
}

export default function AuthCallbackRoute() {
  const incomingUrl = Linking.useURL();
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    state?: string | string[];
  }>();
  const { refreshUser } = useAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void nativePendingAuthStore
      .load()
      .then(async (pending) => {
        if (!pending) {
          throw new Error('Missing pending sign-in');
        }
        let callbackUrl = incomingUrl;
        if (!callbackUrl) {
          const fallback = new URL(pending.redirectUri);
          const code = first(params.code);
          const callbackError = first(params.error);
          const state = first(params.state);
          if (code) {
            fallback.searchParams.set('code', code);
          }
          if (callbackError) {
            fallback.searchParams.set('error', callbackError);
          }
          if (state) {
            fallback.searchParams.set('state', state);
          }
          callbackUrl = fallback.toString();
        }
        await completeAuthCallback(callbackUrl, pending, {
          api: authApi,
          pendingAuth: nativePendingAuthStore,
          tokenStorage,
        });
        if (!active) {
          return;
        }
        await refreshUser();
        if (active) {
          router.replace('/account');
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [incomingUrl, params.code, params.error, params.state, refreshUser]);

  return (
    <Screen scroll={false}>
      <View style={styles.centered}>
        {error ? (
          <>
            <AppText color="danger" variant="heading">
              تعذر إكمال تسجيل الدخول.
            </AppText>
            <AppText color="muted">
              انتهت محاولة الدخول أو لم تطابق بيانات الأمان المحفوظة.
            </AppText>
            <AppButton onPress={() => router.replace('/account')}>
              العودة إلى الحساب
            </AppButton>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <AppText>جار إكمال تسجيل الدخول الآمن...</AppText>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
});
