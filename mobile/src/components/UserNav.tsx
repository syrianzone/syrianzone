import { Image } from 'expo-image';
import { ChevronDown, LayoutDashboard, ListOrdered, LogOut, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

interface UserNavProps {
  onOpenDashboard?: () => void;
  onOpenPolls?: () => void;
  onOpenProfile?: () => void;
}

const labels = {
  ar: {
    account: 'قائمة الحساب',
    dashboard: 'لوحة التحكم',
    polls: 'إدارة التصويت',
    profile: 'الملف الشخصي',
  },
  en: {
    account: 'Account menu',
    dashboard: 'Dashboard',
    polls: 'Manage polls',
    profile: 'Profile',
  },
} as const;

export default function UserNav({
  onOpenDashboard,
  onOpenPolls,
  onOpenProfile,
}: UserNavProps) {
  const { isAdmin, loading, logout, user } = useAuth();
  const { direction, locale, t } = useLocale();
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  if (!user) {
    return null;
  }

  const invoke = (callback?: () => void) => {
    setExpanded(false);
    callback?.();
  };
  const iconColor = theme.palette.foreground;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={labels[locale].account}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border,
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        testID="user-nav-trigger"
      >
        {user.avatar_url ? (
          <Image
            accessibilityLabel={user.name}
            source={{ uri: user.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.fallback,
              { backgroundColor: theme.palette.primary },
            ]}
          >
            <AppText style={{ color: theme.palette.primaryForeground }} variant="label">
              {user.name.charAt(0)}
            </AppText>
          </View>
        )}
        <ChevronDown color={iconColor} size={18} />
      </Pressable>

      {expanded ? (
        <AppCard style={styles.menu} testID="user-nav-menu">
          <View style={styles.identity}>
            <AppText variant="label">{user.name}</AppText>
            <AppText color="muted" variant="caption">
              {user.email}
            </AppText>
          </View>
          <AppButton
            icon={<LayoutDashboard color={iconColor} size={18} />}
            onPress={() => invoke(onOpenDashboard)}
            testID="user-nav-dashboard"
            variant="ghost"
          >
            {labels[locale].dashboard}
          </AppButton>
          {isAdmin ? (
            <AppButton
              icon={<ListOrdered color={iconColor} size={18} />}
              onPress={() => invoke(onOpenPolls)}
              testID="user-nav-polls"
              variant="ghost"
            >
              {labels[locale].polls}
            </AppButton>
          ) : null}
          <AppButton
            icon={<User color={iconColor} size={18} />}
            onPress={() => invoke(onOpenProfile)}
            testID="user-nav-profile"
            variant="ghost"
          >
            {labels[locale].profile}
          </AppButton>
          <AppButton
            icon={<LogOut color={theme.palette.danger} size={18} />}
            loading={loading}
            onPress={() => {
              setExpanded(false);
              void logout();
            }}
            testID="user-nav-logout"
            variant="danger"
          >
            {t('signOut')}
          </AppButton>
        </AppCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  container: {
    alignItems: 'flex-end',
    gap: 8,
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    gap: 2,
    paddingBottom: 8,
  },
  menu: {
    gap: 4,
    minWidth: 240,
  },
  trigger: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 4,
    padding: 3,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/UserNav.tsx (74 lines)
  confidence: high
  todos:      0
  notes:      Native account actions replace browser dropdown links and reload.
*/
