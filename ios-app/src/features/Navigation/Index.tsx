import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { api } from '../../api';
import {
  AdaptivePanes,
  contentStyle,
  FormField,
  Heading,
  Label,
  RequestStatus,
  Section,
} from '../../components';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation } from '../../platform/features';
import { EditorSheet } from '../../platform/Sheet';
import { assetUrl } from '../../platform/validation';
import { useResource } from '../../resource';
import { ProjectIcon } from '../../ui/graphics';
import { NativeAction, NativeIconAction, NativePicker, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import icons from './icons.json';
import {
  committedNavigation,
  decodeNavigationPage,
  editItem,
  moveItem,
  newItem,
  newSubcategory,
  removeItem,
  toggleItem,
  type NavigationConfig,
  type NavItem,
  type NavSubcategory,
} from './model';
export function NavigationAdminScreen(): React.JSX.Element {
  const account = useAccount();
  return (
    <NavigationPanel key={JSON.stringify([account.sessionGeneration, account.user?.effective_permissions])} />
  );
}
function ItemIcon({ item }: { item: NavItem }): React.JSX.Element {
  let image: string | null = null;
  try {
    image = item.isFlag
      ? 'https://syrian.zone/flag-replacer/1f1f8-1f1fe.svg'
      : assetUrl(item.iconUrl || item.image);
  } catch {
    /* Invalid drafts keep their editable icon key. */
  }
  return image ? (
    <Image source={{ uri: image }} contentFit="contain" style={{ width: 32, height: 32 }} />
  ) : (
    <View style={{ width: 32, height: 32 }}>
      <ProjectIcon name={item.iconKey} />
    </View>
  );
}
function NavigationPanel(): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    { colors } = useTheme(),
    stamp = account.sessionGeneration,
    allowed = account.user?.effective_permissions.includes('site.navigation') === true;
  const resource = useResource(
    useCallback(
      (signal) =>
        api.page('/admin/navigation', 'Admin/Navigation/Index', decodeNavigationPage, {
          signal,
          authenticated: true,
          sessionGeneration: stamp,
        }),
      [stamp],
    ),
    { enabled: allowed },
  );
  const [config, setConfig] = useState<NavigationConfig | null>(null),
    [draft, setDraft] = useState<NavItem | null>(null),
    [previous, setPrevious] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null),
    dirty = useRef(false),
    locked = useRef(false);
  useEffect(() => {
    if (resource.data && !dirty.current) setConfig(resource.data.navigation);
  }, [resource.data]);
  function stage(update: (value: NavigationConfig) => NavigationConfig): void {
    if (locked.current) return;
    dirty.current = true;
    setMessage(null);
    setConfig((value) => (value ? update(value) : null));
  }
  function change(patch: Partial<NavItem>): void {
    setDraft((value) => (value ? { ...value, ...patch } : null));
  }
  async function save(reset = false): Promise<void> {
    if (!config || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const committed = await api.request('admin/navigation', committedNavigation, {
        method: 'PUT',
        authenticated: true,
        sessionGeneration: stamp,
        body: reset
          ? { reset: true }
          : {
              navbarTopCount: config.navbarTopCount,
              useSeparateNavbarOrder: config.useSeparateNavbarOrder,
              navbarOrder: config.navbarOrder,
              items: config.items,
            },
      });
      if (api.getSessionGeneration() !== stamp) return;
      setConfig(committed);
      dirty.current = false;
      setMessage(reset ? 'تمت استعادة الأقسام والقوائم الافتراضية.' : 'تم حفظ الأقسام والقوائم.');
    } catch (reason) {
      if (api.getSessionGeneration() === stamp)
        setError(reason instanceof Error ? reason.message : 'تعذر حفظ القائمة.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function subChange(index: number, patch: Partial<NavSubcategory>): void {
    if (draft)
      change({
        subCategories: draft.subCategories.map((item, at) => (at === index ? { ...item, ...patch } : item)),
      });
  }
  const enabled = config?.items.filter((item) => item.enabled).length ?? 0;
  return (
    <AdaptivePanes
      primary={
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          <Heading>الأقسام والقوائم</Heading>
          <Label secondary>ترتيب الأقسام وأسماؤها وأيقوناتها وظهورها في الصفحة الرئيسية وشريط التنقل.</Label>
          {!allowed ? (
            <Section>
              <Label>تحتاج صلاحية إدارة قوائم الموقع.</Label>
              <NativeAction title="الحساب" onPress={() => navigation.open('account')} />
            </Section>
          ) : (
            <>
              <RequestStatus resource={resource} />
              {config ? (
                <>
                  <Section>
                    <Label>
                      {enabled} قسم مفعّل من {config.items.length}، في الرئيسية{' '}
                      {config.items.filter((item) => item.enabled && item.showOnHome).length}، وفي التنقل{' '}
                      {config.items.filter((item) => item.enabled && item.showInNavbar).length}.
                    </Label>
                    <NativePicker
                      disabled={busy}
                      label="عدد الأقسام الظاهرة في الشريط العلوي"
                      value={String(config.navbarTopCount)}
                      options={Array.from({ length: 10 }, (_, index) => ({
                        value: String(index + 1),
                        label: String(index + 1),
                      }))}
                      onChange={(value) =>
                        stage((current) => ({ ...current, navbarTopCount: Number(value) }))
                      }
                    />
                    <NativeAction
                      title="إضافة قسم مخصص"
                      disabled={busy || config.items.length >= 100}
                      onPress={() => {
                        setPrevious(null);
                        setError(null);
                        setDraft(newItem(`custom_${Date.now()}`));
                      }}
                    />
                    <NativeAction
                      title={busy ? 'جارٍ الحفظ' : 'حفظ التغييرات'}
                      prominent
                      disabled={busy}
                      onPress={() => {
                        void save();
                      }}
                    />
                    <NativeAction
                      title="استعادة الإعدادات الافتراضية"
                      destructive
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          'استعادة الافتراضي؟',
                          'سيُستعاد ترتيب الأقسام الأصلي وستُحذف التخصيصات المحفوظة.',
                          [
                            { text: 'إلغاء', style: 'cancel' },
                            {
                              text: 'استعادة',
                              style: 'destructive',
                              onPress: () => {
                                void save(true);
                              },
                            },
                          ],
                        )
                      }
                    />
                  </Section>
                  {config.items.map((item, index) => (
                    <Section key={item.id} style={{ opacity: item.enabled ? 1 : 0.7 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <ItemIcon item={item} />
                        <View style={{ flex: 1 }}>
                          <Label style={{ fontWeight: '700' }}>{item.title || item.text}</Label>
                          {item.subtitle ? <Label secondary>{item.subtitle}</Label> : null}
                          <Label secondary>
                            {item.isCustom ? 'قسم مخصص' : 'قسم أصلي'}،{' '}
                            {item.isInternal ? 'ضمن الأقسام الرئيسية' : 'ضمن المواقع الشقيقة'}
                          </Label>
                        </View>
                      </View>
                      <Label secondary>{item.href}</Label>
                      <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 8 }}>
                        <NativeToggle
                          disabled={busy}
                          title="تفعيل القسم"
                          value={item.enabled}
                          onChange={(value) => stage((current) => toggleItem(current, item.id, value))}
                        />
                        {item.enabled ? (
                          <>
                            <NativeToggle
                              disabled={busy}
                              title="إظهاره في الصفحة الرئيسية"
                              value={item.showOnHome}
                              onChange={(value) =>
                                stage((current) => ({
                                  ...current,
                                  items: current.items.map((row) =>
                                    row.id === item.id ? { ...row, showOnHome: value } : row,
                                  ),
                                }))
                              }
                            />
                            <NativeToggle
                              disabled={busy}
                              title="إظهاره في شريط التنقل"
                              value={item.showInNavbar}
                              onChange={(value) =>
                                stage((current) => ({
                                  ...current,
                                  items: current.items.map((row) =>
                                    row.id === item.id ? { ...row, showInNavbar: value } : row,
                                  ),
                                }))
                              }
                            />
                          </>
                        ) : (
                          <Label secondary>فعّل القسم أولاً لتغيير ظهوره.</Label>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <NativeIconAction
                          title="نقل للأعلى"
                          systemImage="arrow.up"
                          disabled={busy || index === 0}
                          onPress={() => stage((current) => moveItem(current, item.id, -1))}
                        />
                        <NativeIconAction
                          title="نقل للأسفل"
                          systemImage="arrow.down"
                          disabled={busy || index === config.items.length - 1}
                          onPress={() => stage((current) => moveItem(current, item.id, 1))}
                        />
                        <NativeAction
                          title="تعديل"
                          style={{ flex: 1, minWidth: 100 }}
                          disabled={busy}
                          onPress={() => {
                            setPrevious(item.id);
                            setError(null);
                            setDraft({
                              ...item,
                              surfaces: [...item.surfaces],
                              subCategories: item.subCategories.map((sub) => ({ ...sub })),
                            });
                          }}
                        />
                      </View>
                      {item.isCustom ? (
                        <NativeAction
                          title="حذف القسم المخصص"
                          destructive
                          disabled={busy}
                          onPress={() =>
                            Alert.alert('حذف هذا القسم؟', item.title, [
                              { text: 'إلغاء', style: 'cancel' },
                              {
                                text: 'حذف',
                                style: 'destructive',
                                onPress: () => stage((current) => removeItem(current, item.id)),
                              },
                            ])
                          }
                        />
                      ) : null}
                    </Section>
                  ))}
                </>
              ) : null}
            </>
          )}
          {message ? <Label>{message}</Label> : null}
          {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
          <EditorSheet
            title={previous ? 'تعديل القسم' : 'إضافة قسم مخصص'}
            visible={draft !== null}
            close={() => setDraft(null)}
          >
            {draft ? (
              <>
                <FormField
                  label="المعرّف"
                  value={draft.id}
                  maxLength={500}
                  disabled={!draft.isCustom}
                  onChange={(id) => change({ id })}
                />
                <FormField
                  label="اسم القسم"
                  value={draft.title}
                  maxLength={80}
                  onChange={(title) => change({ title, text: title })}
                />
                <FormField
                  label="الوصف"
                  value={draft.subtitle}
                  maxLength={200}
                  onChange={(subtitle) => change({ subtitle })}
                />
                <FormField
                  label="الرابط"
                  value={draft.href}
                  maxLength={2048}
                  keyboardType="url"
                  onChange={(href) => change({ href })}
                />
                <NativePicker
                  disabled={busy}
                  label="نوع الوجهة"
                  value={draft.type}
                  options={[
                    { value: 'native', label: 'واجهة التطبيق الأصلية' },
                    { value: 'web', label: 'صفحة موقع' },
                    { value: 'external', label: 'رابط خارجي' },
                    ...(!['native', 'web', 'external'].includes(draft.type)
                      ? [{ value: draft.type, label: draft.type }]
                      : []),
                  ]}
                  onChange={(type) => change({ type })}
                />
                <FormField
                  label="هدف الوجهة"
                  value={draft.target}
                  maxLength={2048}
                  onChange={(target) => change({ target })}
                />
                <NativePicker
                  disabled={busy}
                  label="أيقونة القسم"
                  value={draft.iconKey}
                  options={[
                    ...icons.map((icon) => ({ value: icon.key, label: icon.label })),
                    ...(!icons.some((icon) => icon.key === draft.iconKey)
                      ? [{ value: draft.iconKey, label: draft.iconKey }]
                      : []),
                  ]}
                  onChange={(iconKey) => change({ iconKey })}
                />
                <FormField
                  label="رابط أيقونة مخصص (اختياري)"
                  value={draft.iconUrl ?? draft.image ?? ''}
                  maxLength={2048}
                  keyboardType="url"
                  onChange={(iconUrl) => change({ iconUrl: iconUrl || null, image: iconUrl || null })}
                />
                <NativeToggle
                  disabled={busy}
                  title="قسم رئيسي بدلاً من موقع شقيق"
                  value={draft.isInternal}
                  onChange={(isInternal) => change({ isInternal })}
                />
                <NativeToggle
                  disabled={busy}
                  title="الظهور في الصفحة الرئيسية"
                  value={draft.showOnHome}
                  onChange={(showOnHome) => change({ showOnHome })}
                />
                <NativeToggle
                  disabled={busy}
                  title="الظهور في التنقل"
                  value={draft.showInNavbar}
                  onChange={(showInNavbar) => change({ showInNavbar })}
                />
                <Heading>الأقسام الفرعية</Heading>
                {draft.subCategories.map((sub, index) => (
                  <Section key={`${index}:${sub.id}`}>
                    <FormField
                      label="عنوان القسم الفرعي"
                      value={sub.title}
                      maxLength={80}
                      onChange={(title) => subChange(index, { title })}
                    />
                    <FormField
                      label="وصف القسم الفرعي"
                      value={sub.subtitle}
                      maxLength={200}
                      onChange={(subtitle) => subChange(index, { subtitle })}
                    />
                    <FormField
                      label="رابط القسم الفرعي"
                      value={sub.href}
                      maxLength={2048}
                      keyboardType="url"
                      onChange={(href) => subChange(index, { href })}
                    />
                    <FormField
                      label="هدف القسم الفرعي"
                      value={sub.target}
                      maxLength={2048}
                      onChange={(target) => subChange(index, { target })}
                    />
                    <NativeAction
                      title="حذف القسم الفرعي"
                      destructive
                      onPress={() =>
                        change({ subCategories: draft.subCategories.filter((_, at) => at !== index) })
                      }
                    />
                  </Section>
                ))}
                <NativeAction
                  title="إضافة قسم فرعي"
                  disabled={draft.subCategories.length >= 30}
                  onPress={() =>
                    change({
                      subCategories: [
                        ...draft.subCategories,
                        newSubcategory(draft, draft.subCategories.length),
                      ],
                    })
                  }
                />
                {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
                <NativeAction
                  title="اعتماد التعديل في القائمة"
                  prominent
                  onPress={() => {
                    if (!config) return;
                    try {
                      const next = editItem(config, previous, draft);
                      stage(() => next);
                      setDraft(null);
                      setError(null);
                    } catch (reason) {
                      setError(reason instanceof Error ? reason.message : 'تحقق من حقول القسم.');
                    }
                  }}
                />
                <Label secondary>بعد اعتماد التعديل اضغط «حفظ التغييرات» لإرساله إلى الموقع.</Label>
              </>
            ) : null}
          </EditorSheet>
        </ScrollView>
      }
    />
  );
}
export default NavigationAdminScreen;

// PORT STATUS: source resources/js/Pages/Admin/Navigation/Index.tsx; confidence high; todos 2 server alias rollout and authenticated native form proof.
