import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';

import {
  createManagedUser,
  deleteManagedUser,
  fetchManagedUsers,
  type AssignableUserRole,
  type ManagedUser,
  toggleManagedUserBan,
} from './usersApi';
import {
  assignableUserRoles,
  canBanManagedUser,
  canDeleteManagedUser,
  filterManagedUsers,
  managedUserBanConfirmation,
  managedUserRoleLabel,
} from './usersModel';

export default function AdminUsersScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableUserRole>('user');
  const [search, setSearch] = useState('');
  const usersQueryKey = ['admin-users', user?.id ?? 'guest'] as const;
  const usersQuery = useQuery({
    enabled: user?.role === 'superadmin',
    queryFn: ({ signal }) => fetchManagedUsers(signal),
    queryKey: usersQueryKey,
  });
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const filtered = useMemo(
    () => filterManagedUsers(users, search),
    [search, users],
  );

  const createUser = useMutation({
    mutationFn: createManagedUser,
    onSuccess: async () => {
      setName('');
      setEmail('');
      setRole('user');
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
  const deleteUser = useMutation({
    mutationFn: deleteManagedUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
  const toggleBan = useMutation({
    mutationFn: ({ id, isBanned }: { id: number; isBanned: boolean }) =>
      toggleManagedUserBan(id, isBanned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });

  if (authLoading) {
    return (
      <Screen title="إدارة المستخدمين">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="إدارة المستخدمين">
        <QueryState detail="سجل الدخول للوصول إلى إدارة المستخدمين." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (user.role !== 'superadmin') {
    return (
      <Screen title="إدارة المستخدمين">
        <QueryState detail="تتطلب هذه الصفحة صلاحية المدير العام." type="error" />
      </Screen>
    );
  }

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل الاسم والبريد الإلكتروني.');
      return;
    }
    createUser.mutate({ email: email.trim(), name: name.trim(), role });
  };

  const confirmDelete = (id: number, targetName: string) => {
    Alert.alert('حذف الحساب؟', `سيتم حذف حساب ${targetName} وسحب جلساته.`, [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => deleteUser.mutate(id),
        style: 'destructive',
        text: 'حذف',
      },
    ]);
  };

  const confirmBanToggle = (target: ManagedUser) => {
    const confirmation = managedUserBanConfirmation(target);
    Alert.alert(confirmation.title, confirmation.message, [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => toggleBan.mutate({
          id: target.id,
          isBanned: confirmation.nextState,
        }),
        style: confirmation.nextState ? 'destructive' : 'default',
        text: confirmation.actionText,
      },
    ]);
  };

  return (
    <Screen
      onRefresh={() => void usersQuery.refetch()}
      refreshing={usersQuery.isRefetching}
      subtitle="إنشاء الحسابات وتحديد الأدوار وسحب الوصول"
      title="إدارة المستخدمين"
    >
      <AppCard style={styles.form}>
        <AppText variant="heading">إضافة حساب</AppText>
        <AppInput onChangeText={setName} placeholder="الاسم" value={name} />
        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="البريد الإلكتروني"
          value={email}
        />
        <View style={styles.roleRow}>
          {assignableUserRoles.map((value) => (
            <AppButton
              key={value}
              onPress={() => setRole(value)}
              variant={role === value ? 'primary' : 'secondary'}
            >
              {managedUserRoleLabel(value)}
            </AppButton>
          ))}
        </View>
        <AppButton loading={createUser.isPending} onPress={submit}>
          إنشاء الحساب
        </AppButton>
        <AppText color="muted" variant="caption">
          واجهة التطبيق تنشئ هذه الأدوار فقط؛ تغيير الدور أو كلمة المرور أو
          الصلاحيات يتم من لوحة الويب.
        </AppText>
        {createUser.isError ? (
          <AppText color="danger">تعذر إنشاء الحساب. تحقق من البريد والدور.</AppText>
        ) : null}
      </AppCard>

      <AppInput
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو البريد أو الدور"
        value={search}
      />

      {usersQuery.isLoading ? (
        <AppText color="muted">جار تحميل الحسابات...</AppText>
      ) : usersQuery.isError ? (
        <QueryState onRetry={() => void usersQuery.refetch()} type="error" />
      ) : filtered.length === 0 ? (
        <QueryState type="empty" />
      ) : (
        filtered.map((target) => {
          const deletable = canDeleteManagedUser(user.id, target);
          const bannable = canBanManagedUser(user, target);
          return (
            <AppCard key={target.id} style={styles.userCard}>
              <View style={styles.userHeading}>
                <View style={styles.grow}>
                  <AppText variant="heading">{target.name}</AppText>
                  <AppText color="muted" variant="caption">{target.email}</AppText>
                </View>
                <AppText color={target.is_banned ? 'danger' : 'primary'} variant="label">
                  {managedUserRoleLabel(target.role)}
                </AppText>
              </View>
              {target.is_banned ? (
                <AppText color="danger" variant="caption">الحساب محظور</AppText>
              ) : null}
              {bannable || deletable ? (
                <View style={styles.actions}>
                  {bannable ? (
                    <AppButton
                      loading={toggleBan.isPending && toggleBan.variables?.id === target.id}
                      onPress={() => confirmBanToggle(target)}
                      variant="secondary"
                    >
                      {target.is_banned ? 'إلغاء الحظر' : 'حظر الحساب'}
                    </AppButton>
                  ) : null}
                  {deletable ? (
                    <AppButton
                      loading={deleteUser.isPending && deleteUser.variables === target.id}
                      onPress={() => confirmDelete(target.id, target.name)}
                      variant="danger"
                    >
                      حذف
                    </AppButton>
                  ) : null}
                </View>
              ) : (
                <AppText color="muted" variant="caption">
                  حساب محمي من التعديل في هذه الواجهة.
                </AppText>
              )}
            </AppCard>
          );
        })
      )}
      {toggleBan.isError || deleteUser.isError ? (
        <AppText color="danger">تعذر تحديث الحساب. أعد المحاولة.</AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  form: {
    gap: 12,
  },
  grow: {
    flex: 1,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userCard: {
    gap: 12,
  },
  userHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
