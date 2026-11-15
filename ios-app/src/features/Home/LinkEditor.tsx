import { useRef, useState } from 'react';
import { Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentStyle, FormField, Heading, Label, Section } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { linkDraft, type CustomLink } from './model';

export function LinkEditor({ link, save, remove, close }: { link: CustomLink | null; save(link: CustomLink): Promise<void>; remove(id: string): Promise<void>; close(): void }): React.JSX.Element {
  const { colors } = useTheme();
  const [name, setName] = useState(link?.name ?? ''), [url, setUrl] = useState(link?.url ?? ''), [icon, setIcon] = useState(link?.icon ?? '');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const id = useRef(link?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  async function perform(action: () => Promise<void>): Promise<void> {
    setBusy(true); setError(null);
    try { await action(); close(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ الرابط.'); }
    finally { setBusy(false); }
  }
  return <Modal visible presentationStyle="pageSheet" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"><NativeAction title="إلغاء" disabled={busy} onPress={close} />
      <Heading>{link ? 'تعديل الرابط' : 'إضافة رابط مخصص'}</Heading><Section>
        <FormField label="اسم الرابط" value={name} onChange={setName} maxLength={100} />
        <FormField label="رابط الموقع" value={url} onChange={setUrl} keyboardType="url" maxLength={2048} />
        <FormField label="رمز تعبيري اختياري" value={icon} onChange={setIcon} maxLength={32} />
        <Label secondary>اترك الرمز فارغاً لاستخدام أيقونة الموقع.</Label>
        {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        <NativeAction title="حفظ الرابط" prominent disabled={busy || !name.trim() || !url.trim()} onPress={() => { void perform(() => save(linkDraft(id.current, name, url, icon))); }} />
        {link ? <NativeAction title="حذف الرابط" destructive disabled={busy} onPress={() => Alert.alert('حذف الرابط؟', link.name, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { void perform(() => remove(link.id)); } }])} /> : null}
      </Section>
    </ScrollView>
  </SafeAreaView></Modal>;
}
// PORT STATUS: source resources/js/Pages/Home/_components/AddLinkDialog.tsx and EditLinkDialog.tsx; confidence medium; todos 1 native keyboard and confirmation verification.
