import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { useResource } from '../../resource';
import { NativeAction, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { committedPopup, decodePopup, popupErrors, type SitePopup } from './model';
export function SitePopupScreen(): React.JSX.Element {
  const account = useAccount();
  return (
    <PopupPanel key={JSON.stringify([account.sessionGeneration, account.user?.effective_permissions])} />
  );
}
function PopupPanel(): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    { colors } = useTheme(),
    stamp = account.sessionGeneration,
    allowed = account.user?.effective_permissions.includes('site.popup') === true;
  const resource = useResource(
    useCallback(
      (signal) =>
        api.request('admin/site-popup', decodePopup, {
          signal,
          authenticated: true,
          sessionGeneration: stamp,
        }),
      [stamp],
    ),
    { enabled: allowed },
  );
  const [draft, setDraft] = useState<SitePopup | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    lock = useRef(false),
    dirty = useRef(false);
  useEffect(() => {
    if (resource.data && !dirty.current) setDraft(resource.data);
  }, [resource.data]);
  function change(patch: Partial<SitePopup>): void {
    if (lock.current) return;
    dirty.current = true;
    setSaved(false);
    setDraft((value) => (value ? { ...value, ...patch } : null));
  }
  async function save(): Promise<void> {
    if (!draft || lock.current) return;
    const errors = popupErrors(draft);
    if (errors.length) {
      setError(errors.join('\n'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const committed = await api.request('admin/site-popup', committedPopup, {
        method: 'PUT',
        authenticated: true,
        sessionGeneration: stamp,
        body: {
          enabled: draft.enabled,
          title: draft.title,
          description: draft.description,
          buttonText: draft.buttonText,
          dismissText: draft.dismissText,
          link: draft.link,
        },
      });
      if (api.getSessionGeneration() !== stamp) return;
      setDraft(committed);
      dirty.current = false;
      setSaved(true);
    } catch (reason) {
      if (api.getSessionGeneration() === stamp)
        setError(reason instanceof Error ? reason.message : 'تعذر حفظ النافذة.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <AdaptivePanes
      primary={
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          <Heading>النافذة المنبثقة للصفحة الرئيسية</Heading>
          {!allowed ? (
            <Section>
              <Label>تحتاج صلاحية إدارة نافذة الموقع.</Label>
              <NativeAction title="الحساب" onPress={() => navigation.open('account')} />
            </Section>
          ) : (
            <>
              <RequestStatus resource={resource} />
              {draft ? (
                <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 16 }}>
                  <Section>
                    <NativeToggle
                      disabled={busy}
                      title="تفعيل النافذة المنبثقة"
                      value={draft.enabled}
                      onChange={(enabled) => change({ enabled })}
                    />
                    <FormField
                      disabled={busy}
                      label="عنوان النافذة"
                      value={draft.title}
                      maxLength={100}
                      onChange={(title) => change({ title })}
                    />
                    <FormField
                      disabled={busy}
                      label="وصف النافذة"
                      value={draft.description}
                      maxLength={500}
                      multiline
                      onChange={(description) => change({ description })}
                    />
                    <FormField
                      disabled={busy}
                      label="نص زر الانتقال"
                      value={draft.buttonText}
                      maxLength={50}
                      onChange={(buttonText) => change({ buttonText })}
                    />
                    <FormField
                      disabled={busy}
                      label="نص زر الإغلاق"
                      value={draft.dismissText}
                      maxLength={50}
                      onChange={(dismissText) => change({ dismissText })}
                    />
                    <FormField
                      disabled={busy}
                      label="رابط زر الانتقال (HTTPS)"
                      value={draft.link}
                      maxLength={2048}
                      onChange={(link) => change({ link })}
                    />
                    <Label secondary>
                      كل حفظ يغيّر إصدار النافذة لعرضها من جديد للزوار. الإصدار المحفوظ: {draft.version}
                    </Label>
                  </Section>
                </View>
              ) : null}
              <NativeAction
                title={busy ? 'جارٍ الحفظ' : 'حفظ الإعدادات'}
                prominent
                disabled={busy || !draft}
                onPress={() => {
                  void save();
                }}
              />
              {saved ? <Label>تم حفظ إعدادات النافذة المنبثقة.</Label> : null}
            </>
          )}
          {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        </ScrollView>
      }
    />
  );
}
export default SitePopupScreen;

// PORT STATUS: source resources/js/Pages/Admin/SitePopup/Index.tsx; confidence high; todos 1 server alias rollout. Native local form save and restore passed account-native-07.
