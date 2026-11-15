import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
import { formatGregorianSyrianShort } from '../../platform/dates';
import { useFeatureNavigation } from '../../platform/features';
import { useScreenActive } from '../../platform/lifecycle';
import { record, text } from '../../platform/validation';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { decodeIssued, decodeTokenPage, issuePayload, tokenBoundary } from './model';
const roleLabels: Readonly<Record<string, string>> = {
  superadmin: 'مدير عام',
  admin: 'مشرف',
  transit_admin: 'مشرف نقل',
  syofficial_admin: 'مشرف الحسابات الرسمية',
  govapps_admin: 'مشرف التطبيقات الحكومية',
  phonebook_admin: 'مشرف دليل الهاتف',
  places_admin: 'مشرف مشوار',
  user: 'مستخدم',
};
import { TokenDisclosure } from './disclosure';
const noPermissions: readonly string[] = [];
export function ApiTokensScreen(): React.JSX.Element {
  const account = useAccount();
  return (
    <TokenPanel
      key={tokenBoundary(account.sessionGeneration, account.user?.effective_permissions ?? noPermissions)}
    />
  );
}
function date(value: string | null): string {
  return value ? formatGregorianSyrianShort(value) : 'غير محدد';
}
function TokenPanel(): React.JSX.Element {
  const account = useAccount(),
    navigation = useFeatureNavigation(),
    active = useScreenActive(),
    { colors } = useTheme(),
    stamp = account.sessionGeneration,
    allowed = Boolean(account.user?.effective_permissions.length);
  const page = useResource(
    useCallback(
      (signal) =>
        api.page('/admin/api-tokens', 'Admin/ApiTokens/Index', decodeTokenPage, {
          signal,
          authenticated: true,
          sessionGeneration: stamp,
        }),
      [stamp],
    ),
    { enabled: allowed },
  );
  const [showForm, setShowForm] = useState(false),
    [ownerId, setOwnerId] = useState(''),
    [name, setName] = useState(''),
    [ttl, setTtl] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null),
    initialized = useRef(false),
    locked = useRef(false),
    pending = useRef<AbortController | null>(null),
    copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [disclosure] = useState(() => new TokenDisclosure());
  const issued = useSyncExternalStore(disclosure.subscribe, disclosure.snapshot, () => null);
  useEffect(() => disclosure.mount(), [disclosure]);
  useEffect(() => {
    if (!page.data) return;
    if (!initialized.current) {
      initialized.current = true;
      setOwnerId(page.data.selfService ? String(page.data.owners[0]?.id ?? '') : '');
      setTtl(page.data.ttlOptions[1]?.value ?? page.data.ttlOptions[0]?.value ?? '');
    }
    const offered = new Set(Object.values(page.data.capabilities).flatMap((group) => Object.keys(group)));
    setSelected((value) => value.filter((permission) => offered.has(permission)));
  }, [page.data]);
  useEffect(() => {
    if (!active) {
      pending.current?.abort();
      disclosure.clear();
      setCopied(false);
    }
    return () => {
      pending.current?.abort();
    };
  }, [active, disclosure]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  async function perform(work: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (locked.current || account.busy || !active) return;
    locked.current = true;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work(controller.signal);
    } catch (reason) {
      if (!controller.signal.aborted && api.getSessionGeneration() === stamp)
        setError(reason instanceof Error ? reason.message : 'تعذر تحديث الرموز.');
    } finally {
      if (pending.current === controller) pending.current = null;
      locked.current = false;
      setBusy(false);
    }
  }
  function issue(): void {
    if (!page.data) return;
    let body: ReturnType<typeof issuePayload>;
    try {
      body = issuePayload(page.data, ownerId, name, ttl, selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تحقق من حقول الرمز.');
      return;
    }
    void perform(async (signal) => {
      const ticket = disclosure.begin();
      setCopied(false);
      const result = await api.request('admin/api-tokens', decodeIssued, {
        method: 'POST',
        authenticated: true,
        sessionGeneration: stamp,
        body,
        signal,
      });
      if (signal.aborted || api.getSessionGeneration() !== stamp) return;
      disclosure.offer(ticket, result);
      setName('');
      setSelected([]);
      page.reload();
    });
  }
  function revoke(id: number, nameToRevoke: string): void {
    Alert.alert('إبطال هذا الرمز؟', nameToRevoke, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إبطال',
        style: 'destructive',
        onPress: () => {
          void perform(async (signal) => {
            const result = await api.request(
              `admin/api-tokens/${id}`,
              (value) => text(record(value).message),
              { method: 'DELETE', authenticated: true, sessionGeneration: stamp, signal },
            );
            if (signal.aborted) return;
            disclosure.clear();
            setMessage(result);
            page.reload();
          });
        },
      },
    ]);
  }
  function revokeAll(userId: number, ownerName: string): void {
    if (page.data?.selfService !== false) return;
    Alert.alert(
      'إبطال جميع رموز المستخدم؟',
      `سيتم إبطال جميع رموز ${ownerName}، بما فيها جلسات تطبيق الهاتف. هذا الإجراء مخصص للاستجابة لتسرّب الرموز.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إبطال الجميع',
          style: 'destructive',
          onPress: () => {
            void perform(async (signal) => {
              const result = await api.request(
                `admin/users/${userId}/api-tokens`,
                (value) => text(record(value).message),
                { method: 'DELETE', authenticated: true, sessionGeneration: stamp, signal },
              );
              if (signal.aborted) return;
              disclosure.clear();
              setMessage(result);
              await account.refresh();
              page.reload();
            });
          },
        },
      ],
    );
  }
  function copy(): void {
    if (!issued || !active || locked.current) return;
    const plaintext = issued.token;
    void perform(async (signal) => {
      await Clipboard.setStringAsync(plaintext);
      if (signal.aborted) return;
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }
  const disabled = busy || account.busy,
    data = page.data,
    selectedOwner = data?.owners.find((owner) => String(owner.id) === ownerId);
  const instructions = data
    ? `curl -X POST ${data.endpoint} \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
    : '';
  return (
    <AdaptivePanes
      primary={
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          <Heading>رموز وكلاء الذكاء الاصطناعي</Heading>
          {!allowed ? (
            <Section>
              <Label>تحتاج حساباً يملك إحدى صلاحيات المنصة لإدارة رموز الوكلاء.</Label>
              <NativeAction title="الحساب" onPress={() => navigation.open('account')} />
            </Section>
          ) : (
            <>
              <RequestStatus resource={page} />
              {data ? (
                <>
                  <Label secondary>رموز وصول للوكلاء على {data.endpoint}</Label>
                  <NativeAction
                    title={showForm ? 'إغلاق نموذج الرمز الجديد' : 'رمز جديد'}
                    systemImage="key"
                    disabled={disabled}
                    onPress={() => setShowForm(!showForm)}
                  />
                  <Section>
                    <Heading>كيف يتصل الوكيل</Heading>
                    <Label>يُرسل الرمز في كل طلب بصيغة Authorization: Bearer &lt;token&gt;.</Label>
                    <Text
                      selectable
                      style={{
                        color: colors.text,
                        writingDirection: 'ltr',
                        textAlign: 'left',
                        fontFamily: 'Menlo',
                        fontSize: 12,
                      }}
                    >
                      {instructions}
                    </Text>
                    <Label secondary>
                      أو استخدم php artisan mcp:inspector mcp/admin للحصول على إعدادات جاهزة لعميلك. كل نداء
                      للأداة يُسجّل مع الرمز والمستخدم والنتيجة في mcp_tool_calls.
                    </Label>
                  </Section>
                  {issued && active ? (
                    <Section>
                      <Heading>تم إنشاء الرمز</Heading>
                      <Label>{issued.message}</Label>
                      <Text
                        selectable
                        style={{
                          color: colors.text,
                          writingDirection: 'ltr',
                          textAlign: 'left',
                          fontFamily: 'Menlo',
                        }}
                      >
                        {issued.token}
                      </Text>
                      <NativeAction
                        title={copied ? 'تم النسخ' : 'نسخ الرمز'}
                        disabled={disabled}
                        systemImage="doc.on.doc"
                        onPress={copy}
                      />
                      <Label secondary>
                        لن يظهر هذا الرمز مرة أخرى. يحتفظ الخادم بتجزئته فقط. إذا فقدته، أبطله وأصدر غيره.
                        يُخفى هنا عند مغادرة الشاشة أو انتقال التطبيق إلى الخلفية.
                      </Label>
                      {issued.abilities.length ? (
                        <Label secondary>الصلاحيات الممنوحة: {issued.abilities.join('، ')}</Label>
                      ) : null}
                      {issued.dropped.length ? (
                        <Label secondary>الصلاحيات التي تجاهلها الخادم: {issued.dropped.join('، ')}</Label>
                      ) : null}
                      <Label secondary>ينتهي: {date(issued.expires)}</Label>
                      <NativeAction
                        title="فهمت، أخفِ الرمز"
                        onPress={() => {
                          disclosure.clear();
                          setCopied(false);
                        }}
                      />
                    </Section>
                  ) : null}
                  {showForm ? (
                    <Section>
                      <Heading>إنشاء رمز</Heading>
                      <Label secondary>
                        {data.selfService
                          ? 'الرمز لحسابك ويحمل ما تختاره من صلاحياتك فقط. سحب صلاحية منك يوقف استخدامها عبر الرمز فوراً.'
                          : 'يُمنح الرمز ما يملكه المستخدم فعلاً فقط. اختر الصلاحيات المحددة التي يحتاجها الوكيل.'}
                      </Label>
                      <View pointerEvents={disabled ? 'none' : 'auto'} style={{ gap: 12 }}>
                        {data.selfService ? (
                          <Label>المستخدم: {data.owners[0]?.name ?? 'غير متاح'}</Label>
                        ) : (
                          <NativePicker
                            disabled={disabled}
                            label="المستخدم"
                            value={ownerId}
                            options={[
                              { value: '', label: 'اختر مستخدماً' },
                              ...data.owners.map((owner) => ({
                                value: String(owner.id),
                                label: `${owner.name}، ${roleLabels[owner.role] ?? owner.role}`,
                              })),
                            ]}
                            onChange={setOwnerId}
                          />
                        )}
                        <FormField label="اسم الرمز" value={name} maxLength={255} onChange={setName} />
                        <Label secondary>يظهر الاسم في سجل التدقيق.</Label>
                        <NativePicker
                          disabled={disabled}
                          label="مدة الصلاحية"
                          value={ttl}
                          options={data.ttlOptions}
                          onChange={setTtl}
                        />
                        {selectedOwner?.role === 'superadmin' ? (
                          <Label secondary>
                            هذا المستخدم مدير عام. يُمنح الرمز ما تختاره بالضبط وتبقى بقية الصلاحيات خارجه.
                          </Label>
                        ) : null}
                        {Object.entries(data.capabilities).map(([group, permissions]) => (
                          <Section key={group}>
                            <Label style={{ fontWeight: '700' }}>
                              {data.capabilityGroups[group]?.label ?? group}
                            </Label>
                            {Object.entries(permissions).map(([permission, label]) => (
                              <NativeToggle
                                disabled={disabled}
                                key={permission}
                                title={label}
                                value={selected.includes(permission)}
                                onChange={(checked) =>
                                  setSelected((current) =>
                                    checked
                                      ? [...new Set([...current, permission])]
                                      : current.filter((item) => item !== permission),
                                  )
                                }
                              />
                            ))}
                          </Section>
                        ))}
                      </View>
                      <Label secondary>{selected.length} صلاحية محددة.</Label>
                      <NativeAction
                        title={busy ? 'جارٍ الإصدار' : 'إصدار الرمز'}
                        prominent
                        disabled={disabled}
                        onPress={issue}
                      />
                    </Section>
                  ) : null}
                  <Heading>
                    {data.selfService ? 'رموزك' : 'الرموز الصادرة'} ({data.tokens.length})
                  </Heading>
                  {!data.tokens.length ? <Label secondary>لا توجد رموز بعد.</Label> : null}
                  {data.tokens.map((token) => (
                    <Section key={token.id}>
                      <Label style={{ fontWeight: '700' }}>{token.name}</Label>
                      {!data.selfService ? (
                        <Label>
                          المستخدم: {token.owner?.name ?? 'غير متاح'}
                          {token.ownerBanned ? '، الحساب محظور' : ''}
                        </Label>
                      ) : null}
                      <Label secondary>الصلاحيات: {token.abilities.join('، ') || 'بلا صلاحيات'}</Label>
                      <Label secondary>
                        آخر استخدام: {token.lastUsed ? date(token.lastUsed) : 'لم يُستخدم'}
                      </Label>
                      <Label style={token.expired ? { color: colors.danger } : undefined}>
                        ينتهي: {token.expired ? 'منتهٍ' : date(token.expires)}
                      </Label>
                      <NativeAction
                        title="إبطال هذا الرمز"
                        destructive
                        disabled={disabled}
                        onPress={() => revoke(token.id, token.name)}
                      />
                      {!data.selfService && token.owner ? (
                        <NativeAction
                          title="إبطال كل رموز هذا المستخدم"
                          destructive
                          disabled={disabled}
                          onPress={() => {
                            if (token.owner) revokeAll(token.owner.id, token.owner.name);
                          }}
                        />
                      ) : null}
                    </Section>
                  ))}
                </>
              ) : null}
            </>
          )}
          {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
          {message ? <Label>{message}</Label> : null}
        </ScrollView>
      }
    />
  );
}
export default ApiTokensScreen;

// PORT STATUS: source resources/js/Pages/Admin/ApiTokens/Index.tsx; confidence medium; todos 2 trusted-mobile policy rollout and authenticated native issuance/revocation proof on a non-production account.
