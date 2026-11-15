import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '../../api';
import { FormField, Label, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { NativeAction } from '../../ui/native';

export function SuperadminSignIn({ initiallyOpen }: { initiallyOpen: boolean }): React.JSX.Element {
  const account = useAccount();
  const [open, setOpen] = useState(initiallyOpen), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [fields, setFields] = useState<Partial<Record<'email' | 'password', string>>>({});
  const [retryUntil, setRetryUntil] = useState<number | null>(null), [now, setNow] = useState(Date.now);
  const locked = useRef(false);
  useEffect(() => {
    if (retryUntil === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryUntil) setRetryUntil(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryUntil]);
  const remaining = retryUntil === null ? 0 : Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const disabled = account.busy || !account.ready;
  async function submit(): Promise<void> {
    if (disabled || locked.current || remaining > 0) return;
    locked.current = true;
    setFields({});
    try { await account.signInSuperadmin(email, password); }
    catch (reason) {
      if (reason instanceof ApiError) {
        setFields({ ...(reason.fields.email?.[0] ? { email: reason.fields.email[0] } : {}), ...(reason.fields.password?.[0] ? { password: reason.fields.password[0] } : {}) });
        if (reason.status === 429 && reason.retryAfter) { const current = Date.now(); setNow(current); setRetryUntil(current + reason.retryAfter * 1000); }
      }
    } finally { setPassword(''); locked.current = false; }
  }
  return <Section>
    <NativeAction title={open ? 'إخفاء دخول الإدارة' : 'دخول الإدارة بكلمة المرور'} disabled={disabled} onPress={() => { setOpen(value => !value); setPassword(''); setFields({}); }} />
    {open ? <View style={{ gap: 12 }}>
      <Label style={{ fontWeight: '700' }}>دخول مشرفي لوحة الإدارة</Label>
      <Label secondary>مخصّص للحسابات التي يسمح لها الموقع بدخول لوحة الإدارة. تسجيل الدخول العادي متاح عبر Google.</Label>
      <FormField label="البريد الإلكتروني للإدارة" value={email} onChange={setEmail} keyboardType="email-address" disabled={disabled} {...(fields.email ? { error: fields.email } : {})} />
      <FormField label="كلمة مرور الإدارة" value={password} onChange={setPassword} secureTextEntry disabled={disabled} {...(fields.password ? { error: fields.password } : {})} />
      {remaining > 0 ? <Label secondary>يمكنك المحاولة مجدداً بعد {remaining} ثانية.</Label> : null}
      <NativeAction title={account.busy ? 'جارٍ تسجيل الدخول' : 'دخول لوحة الإدارة'} prominent disabled={disabled || remaining > 0} onPress={() => { void submit(); }} />
    </View> : null}
  </Section>;
}
