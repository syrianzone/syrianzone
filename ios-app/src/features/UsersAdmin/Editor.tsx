import { useState } from 'react';
import { View } from 'react-native';
import { FormField, Heading, Label, Section } from '../../components';
import { ProjectIcon } from '../../ui/graphics';
import { NativeAction, NativePicker, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import type { Options, UserForm, UserRecord } from './model';

export function UserEditor({
  form,
  original,
  options,
  busy,
  fields,
  update,
  onSave,
  onReload
}: {
  form: UserForm;
  original: UserRecord | null;
  options: Options;
  busy: boolean;
  fields: Readonly<Record<string, readonly string[]>>;
  update(patch: Partial<UserForm>): void;
  onSave(): void;
  onReload(): void;
}): React.JSX.Element {
  const { colors } = useTheme(),
    [open, setOpen] = useState(() => options.groups.map((group) => group.id));
  const selectedRole = options.roles.find((role) => role.value === form.role),
    known = new Set(options.groups.flatMap((group) => group.permissions.map((permission) => permission.id)));
  const unknown = original?.permissions.filter((permission) => !known.has(permission)) ?? [];
  const transit = options.groups.find((group) => group.id === 'transit'),
    showScope = transit?.permissions.some((permission) => form.permissions.includes(permission.id)) ?? false;
  const scopeCities = [
    ...options.cities,
    ...form.allowedLegacyScope
      .filter((id) => !options.cities.some((city) => city.id === id))
      .map((id) => ({ id, name: `${id} (محافظة محفوظة غير متاحة)` }))
  ];
  const error = (key: string) => (fields[key]?.[0] ? { error: fields[key]![0]! } : {});
  return (
    <View style={{ gap: 16 }}>
      <Heading>{form.id === null ? 'إنشاء مستخدم' : `تعديل ${original?.name ?? 'المستخدم'}`}</Heading>
      {original?.isSelf ? (
        <Label style={{ color: colors.danger }}>هذا حسابك. تعديل دوره قد يزيل صلاحية الإدارة، وحذفه ينهي تسجيل الدخول.</Label>
      ) : null}
      {original?.deletedAt ? <Label secondary>هذا المستخدم محذوف مؤقتاً. يمكنك تعديل بياناته أو استعادته من القائمة.</Label> : null}
      <FormField label="الاسم" value={form.name} onChange={(name) => update({ name })} autoCorrect={false} maxLength={255} disabled={busy} {...error('name')} />
      <FormField
        label="البريد الإلكتروني"
        value={form.email}
        onChange={(email) => update({ email })}
        keyboardType="email-address"
        maxLength={255}
        disabled={busy}
        {...error('email')}
      />
      <NativePicker
        label="الدور"
        value={form.role}
        options={[{ value: '', label: 'اختر الدور' }, ...options.roles.map((role) => ({ value: role.value, label: role.label }))]}
        onChange={(role) => update({ role, banned: options.roles.find((option) => option.value === role)?.canBeBanned ? form.banned : false })}
        disabled={busy}
      />
      <NativeToggle
        title="محظور"
        value={form.banned}
        onChange={(banned) => update({ banned })}
        disabled={busy || !(original ? original.actions.changeBan && selectedRole?.canBeBanned : selectedRole?.canBeBanned)}
      />
      <FormField
        label={form.id === null ? 'كلمة المرور المطلوبة للمستخدم الجديد' : 'كلمة مرور جديدة، اتركها فارغة للحفاظ على الحالية'}
        value={form.password}
        onChange={(password) => update({ password })}
        secureTextEntry
        maxLength={255}
        disabled={busy}
        {...error('password')}
      />
      <Heading subtitle="الخيارات والصلاحيات الفعالة مصدرها الخادم">الصلاحيات التفصيلية</Heading>
      {original ? <Label secondary>عدد الصلاحيات الفعالة حالياً: {original.effectivePermissions.length}</Label> : null}
      {unknown.length ? <Label secondary>صلاحيات محفوظة خارج قائمة التحرير ستبقى كما هي: {unknown.join('، ')}</Label> : null}
      {options.groups.map((group) => (
        <Section key={group.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ProjectIcon name={group.icon} size={28} />
            <View style={{ flex: 1 }}>
              <NativeAction
                title={`${open.includes(group.id) ? 'طي' : 'فتح'} ${group.label} (${group.permissions.filter((permission) => form.permissions.includes(permission.id)).length})`}
                onPress={() =>
                  setOpen((previous) => (previous.includes(group.id) ? previous.filter((id) => id !== group.id) : [...previous, group.id]))
                }
                disabled={busy}
              />
            </View>
          </View>
          {open.includes(group.id)
            ? group.permissions.map((permission) => (
                <NativeToggle
                  key={permission.id}
                  title={permission.label}
                  value={form.permissions.includes(permission.id)}
                  onChange={(checked) =>
                    update({ permissions: checked ? [...form.permissions, permission.id] : form.permissions.filter((id) => id !== permission.id) })
                  }
                  disabled={busy}
                />
              ))
            : null}
        </Section>
      ))}
      {showScope ? (
        <Section>
          <Heading subtitle="لا تختَر محافظة للسماح بجميع المحافظات. النطاق يخص صلاحيات النقل فقط.">نطاق المحافظات</Heading>
          {scopeCities.map((city) => (
            <NativeToggle
              key={city.id}
              title={city.name}
              value={form.scope.includes(city.id)}
              onChange={(checked) => update({ scope: checked ? [...form.scope, city.id] : form.scope.filter((id) => id !== city.id) })}
              disabled={busy}
            />
          ))}
        </Section>
      ) : null}
      <NativeAction title="حفظ المستخدم" prominent disabled={busy || !form.role} onPress={onSave} />
      {original ? <NativeAction title="تجاهل التعديلات وقراءة آخر نسخة من الخادم" disabled={busy} onPress={onReload} /> : null}
    </View>
  );
}
// PORT STATUS: source UserResource form and grouped permission helpers; confidence medium; todos 1 native secure-field and keyboard review.
