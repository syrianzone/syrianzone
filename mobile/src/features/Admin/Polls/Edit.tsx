import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Save } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import AdminPollManager from '@/components/admin/AdminPollManager';
import {
  type AdminPollDetail,
  fetchAdminPollDetail,
  updateAdminPoll,
} from '@/components/admin/api';
import { canManagePolls } from '@/components/admin/model';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

interface EditPollProps {
  onBack?: () => void;
  onSaved?: () => void;
  pollId?: string;
}

interface EditContentProps extends EditPollProps {
  data: AdminPollDetail;
  onRefresh: () => Promise<unknown>;
}

function EditContent({
  data,
  onBack,
  onRefresh,
  onSaved,
}: EditContentProps) {
  const { theme } = useAppTheme();
  const [title, setTitle] = useState(data.poll.title);
  const [slug, setSlug] = useState(data.poll.slug);
  const [isActive, setIsActive] = useState(data.poll.isActive);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  } | null>(null);

  const save = async () => {
    if (!title.trim() || !slug.trim()) {
      setMessage({ text: 'العنوان والمعرف مطلوبان.', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateAdminPoll(data.poll.id, {
        isActive,
        slug: slug.trim(),
        timezone: data.poll.timezone,
        title: title.trim(),
      });
      setMessage({ text: 'تم حفظ إعدادات التصويت.', type: 'success' });
      onSaved?.();
    } catch (cause) {
      setMessage({
        text:
          cause instanceof Error
            ? cause.message
            : 'حدث خطأ أثناء حفظ الإعدادات.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      subtitle={data.poll.title}
      title="تعديل التصويت"
      trailing={onBack ? (
        <AppButton
          icon={<ArrowRight color={theme.palette.foreground} size={18} />}
          onPress={onBack}
          variant="ghost"
        >
          رجوع
        </AppButton>
      ) : null}
    >
      {message ? (
        <AppCard
          style={{
            borderColor:
              message.type === 'success'
                ? theme.palette.success
                : theme.palette.danger,
          }}
        >
          <AppText color={message.type === 'success' ? 'success' : 'danger'}>
            {message.text}
          </AppText>
        </AppCard>
      ) : null}
      <AppCard style={styles.form}>
        <AppText variant="heading">الإعدادات الأساسية</AppText>
        <AppText variant="label">العنوان</AppText>
        <AppInput maxLength={200} onChangeText={setTitle} value={title} />
        <AppText variant="label">المعرف (Slug)</AppText>
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
          onChangeText={setSlug}
          textAlign="left"
          value={slug}
        />
        <View style={styles.switchRow}>
          <AppText style={styles.grow} variant="label">التصويت نشط</AppText>
          <Switch
            accessibilityLabel="التصويت نشط"
            onValueChange={setIsActive}
            thumbColor={theme.palette.primaryForeground}
            trackColor={{
              false: theme.palette.border,
              true: theme.palette.primary,
            }}
            value={isActive}
          />
        </View>
        <AppButton
          icon={<Save color={theme.palette.primaryForeground} size={18} />}
          loading={saving}
          onPress={() => void save()}
        >
          حفظ التغييرات
        </AppButton>
      </AppCard>
      <AppCard style={styles.managerCard}>
        <AppText variant="heading">إدارة المجموعات والمرشحين</AppText>
        <AdminPollManager
          initialData={data}
          onRefresh={onRefresh}
          pollId={data.poll.id}
        />
      </AppCard>
    </Screen>
  );
}

function detailRevision(data: AdminPollDetail): string {
  return [
    data.poll.id,
    data.groups
      .map((group) => `${group.id}:${group.sortOrder}:${group.isDefault}`)
      .join(','),
    data.candidates
      .map(
        (candidate) =>
          `${candidate.id}:${candidate.groupId}:${candidate.status}:${candidate.termEndedAt}:${candidate.successorId}`,
      )
      .join(','),
  ].join('|');
}

export default function Edit({ onBack, onSaved, pollId }: EditPollProps) {
  const { loading: authLoading, login, user } = useAuth();
  const { theme } = useAppTheme();
  const permitted = canManagePolls(user?.role);
  const query = useQuery({
    enabled: Boolean(pollId && permitted),
    queryFn: ({ signal }) => fetchAdminPollDetail(pollId!, signal),
    queryKey: ['admin-poll-detail', pollId],
  });

  if (authLoading) {
    return (
      <Screen title="تعديل التصويت">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="تعديل التصويت">
        <QueryState detail="سجل الدخول للوصول إلى إدارة الاستبيانات." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="تعديل التصويت">
        <QueryState detail="لا يملك هذا الحساب صلاحية إدارة الاستبيانات." type="error" />
      </Screen>
    );
  }
  if (!pollId) {
    return (
      <Screen title="تعديل التصويت">
        <QueryState detail="لم يتم تحديد التصويت المطلوب." type="error" />
      </Screen>
    );
  }
  if (query.isPending) {
    return (
      <Screen title="تعديل التصويت">
        <View style={styles.loading}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
          <AppText color="muted">جار تحميل بيانات التصويت...</AppText>
        </View>
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen title="تعديل التصويت">
        <QueryState
          detail="تعذر تحميل بيانات التصويت."
          onRetry={() => void query.refetch()}
          type="error"
        />
      </Screen>
    );
  }

  return (
    <EditContent
      data={query.data}
      key={detailRevision(query.data)}
      onBack={onBack}
      onRefresh={query.refetch}
      onSaved={onSaved}
      pollId={pollId}
    />
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  grow: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 260,
  },
  managerCard: {
    gap: 16,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Polls/Edit.tsx (158 lines)
  confidence: high
  todos:      0
  notes:      Archived-inclusive admin fetch, metadata form, lifecycle manager, and role gate preserve the source edit flow.
*/
