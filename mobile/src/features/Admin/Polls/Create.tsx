import { ArrowRight, Save, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  createAdminPoll,
  type AdminPollCatalogItem,
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

interface CreatePollProps {
  onBack?: () => void;
  onCreated?: (poll: AdminPollCatalogItem) => void;
}

export default function Create({ onBack, onCreated }: CreatePollProps) {
  const { loading: authLoading, login, user } = useAuth();
  const { theme } = useAppTheme();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  if (authLoading) {
    return (
      <Screen title="إنشاء تصويت جديد">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="إنشاء تصويت جديد">
        <QueryState detail="سجل الدخول للوصول إلى إدارة الاستبيانات." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!canManagePolls(user.role)) {
    return (
      <Screen title="إنشاء تصويت جديد">
        <QueryState detail="لا يملك هذا الحساب صلاحية إدارة الاستبيانات." type="error" />
      </Screen>
    );
  }

  const save = async () => {
    const cleanTitle = title.trim();
    const cleanSlug = slug.trim();
    if (!cleanTitle || !cleanSlug) {
      setError('العنوان والمعرف مطلوبان.');
      return;
    }
    setSaving(true);
    setError(null);
    setCreated(false);
    try {
      const poll = await createAdminPoll({
        isActive: true,
        slug: cleanSlug,
        timezone: 'Europe/Amsterdam',
        title: cleanTitle,
      });
      setCreated(true);
      onCreated?.({ ...poll, candidatesCount: 0 });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'تعذر إنشاء التصويت.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="إنشاء تصويت جديد"
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
      {error ? (
        <AppCard style={{ borderColor: theme.palette.danger }}>
          <AppText color="danger">{error}</AppText>
        </AppCard>
      ) : null}
      {created ? (
        <AppCard style={{ borderColor: theme.palette.success }}>
          <AppText color="success">تم إنشاء التصويت بنجاح.</AppText>
        </AppCard>
      ) : null}
      <AppCard style={styles.form}>
        <View style={styles.heading}>
          <ShieldAlert color={theme.palette.primary} size={24} />
          <AppText variant="heading">المعلومات الأساسية</AppText>
        </View>
        <AppText variant="label">العنوان</AppText>
        <AppInput
          maxLength={200}
          onChangeText={setTitle}
          placeholder="مثال: تقييم الأداء الحكومي"
          testID="admin-poll-title"
          value={title}
        />
        <AppText variant="label">المعرف (Slug)</AppText>
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
          onChangeText={setSlug}
          placeholder="govt-2026"
          testID="admin-poll-slug"
          textAlign="left"
          value={slug}
        />
        <AppText color="muted" variant="caption">
          المنطقة الزمنية الافتراضية: Europe/Amsterdam
        </AppText>
        <AppButton
          disabled={!title.trim() || !slug.trim()}
          icon={<Save color={theme.palette.primaryForeground} size={18} />}
          loading={saving}
          onPress={() => void save()}
          testID="admin-poll-create"
        >
          إنشاء التصويت
        </AppButton>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Polls/Create.tsx (96 lines)
  confidence: high
  todos:      0
  notes:      Native validated inputs and bearer mutation preserve poll creation and the source timezone default.
*/
