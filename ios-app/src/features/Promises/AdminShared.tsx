import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { api, ApiError } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label } from '../../components';
import { useAccount, useCan } from '../../platform/account';
import { useFeatureNavigation } from '../../platform/features';
import { record } from '../../platform/validation';
import { useResource } from '../../resource';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';

export function usePromiseAdmin() {
  const account = useAccount();
  const create = useCan('promises.create'), edit = useCan('promises.edit'), remove = useCan('promises.delete'), rule = useCan('promises.rule'), review = useCan('promises.review'), speakers = useCan('promises.speakers');
  const any = create || edit || remove || rule || review || speakers;
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [fields, setFields] = useState<Readonly<Record<string, readonly string[]>>>({}); const writing = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (task: (generation: number) => Promise<void>) => {
    if (writing.current || !account.ready || account.busy || !any) return;
    const generation = account.sessionGeneration; writing.current = true; setBusy(true); setError(null); setFields({});
    try { await task(generation); } catch (reason) { if (alive.current && generation === api.getSessionGeneration()) { setError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء'); if (reason instanceof ApiError) setFields(reason.fields); } }
    finally { writing.current = false; if (alive.current) setBusy(false); }
  };
  return { account, create, edit, remove, rule, review, speakers, any, busy: busy || account.busy, error, fields, run, setError };
}
export type PromiseAdmin = ReturnType<typeof usePromiseAdmin>;
export function useAdminPage<T>(path: string, component: string, decode: (value: unknown) => T, manager: PromiseAdmin, allowed: boolean) {
  return useResource(useCallback(signal => api.page(path, component, decode, { signal, authenticated: true, sessionGeneration: manager.account.sessionGeneration }), [path, component, decode, manager.account.sessionGeneration]), { enabled: manager.account.ready && allowed });
}
export function AdminHeader({ title, current, queueCount = 0, manager }: { title: string; current: string; queueCount?: number; manager: PromiseAdmin }): React.JSX.Element {
  const navigation = useFeatureNavigation(); const { colors } = useTheme();
  const options = [{ value: 'admin', label: 'إدارة الوعود' }, ...(manager.review ? [{ value: 'admin-review', label: `المراجعة (${queueCount})` }] : []), ...(manager.speakers ? [{ value: 'admin-speakers', label: 'المسؤولون' }, { value: 'admin-sectors', label: 'القطاعات' }] : [])];
  return <View style={{ gap: 12 }}><Heading>{title}</Heading>{manager.any ? <NativePicker label="أقسام إدارة الوعود" value={current} options={options} disabled={manager.busy} onChange={view => navigation.open('promises', { view })} /> : <><EmptyState title={manager.account.ready ? 'لا تملك صلاحية إدارة الوعود' : 'جارٍ قراءة صلاحيات الحساب'} />{manager.account.ready && !manager.account.user ? <NativeAction title="تسجيل الدخول" onPress={() => { void manager.account.signIn().catch(reason => manager.setError(reason instanceof Error ? reason.message : 'تعذّر تسجيل الدخول')); }} /> : null}</>}
    {manager.error ? <Label style={{ color: colors.danger }}>{manager.error}</Label> : null}</View>;
}
export function assertAdminSuccess(value: unknown): void { if (record(value).success !== true) throw new Error('لم يؤكد الخادم نجاح الإجراء'); }
export function AdminConfirm({ title, detail, busy, error, onConfirm, onClose }: { title: string | null; detail?: string; busy: boolean; error: string | null; onConfirm(): void; onClose(): void }): React.JSX.Element {
  const { colors } = useTheme(); return <Modal visible={title !== null} presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}><AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><Heading>{title}</Heading>{detail ? <Label>{detail}</Label> : null}<NativeAction title="تأكيد" destructive onPress={onConfirm} disabled={busy} /><NativeAction title="إلغاء" onPress={onClose} disabled={busy} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</ScrollView>} /></Modal>;
}
// PORT STATUS: source Admin/Promises/_components/{AdminHeader,AdminNav}.tsx and capability-specific native mutation ownership; confidence high; todos 0.
