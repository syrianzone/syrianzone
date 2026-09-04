import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  cleanOptionalText,
  cleanRequiredText,
  type DirectoryAdminAccess,
  DirectoryImage,
  DirectoryImagePickerButton,
  DirectoryOrderActions,
  DirectorySearchField,
  DirectoryVisibilityField,
  getDirectoryAdminAccess,
  hasDirectoryAdminAccess,
  moveDirectoryId,
  safeDirectoryId,
  safeOptionalHttpUrl,
} from '@/components/directory';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { directoryQueryKeys } from '@/lib/api/directories';
import type { AuthUser } from '@/lib/auth/types';
import {
  createGovernmentApp,
  deleteGovernmentApp,
  fetchGovernmentAppsAdmin,
  type AdminGovernmentApp,
  type GovernmentAppInput,
  type PickedDirectoryImage,
  reorderGovernmentApps,
  setGovernmentAppVisibility,
  updateGovernmentApp,
} from '@/lib/api/directories/admin';

import { filterGovernmentApps } from './model';

export function getGovernmentAppsAdminAccess(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
) {
  return getDirectoryAdminAccess(user, 'govapps', 'govapps_admin');
}

export function canManageGovernmentApps(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
): boolean {
  return hasDirectoryAdminAccess(
    getGovernmentAppsAdminAccess(user),
  );
}

export default function GovernmentAppsAdminScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const access = getGovernmentAppsAdminAccess(user);
  const permitted = hasDirectoryAdminAccess(access);

  if (authLoading) {
    return (
      <Screen title="إدارة التطبيقات الحكومية">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="إدارة التطبيقات الحكومية">
        <QueryState detail="سجل الدخول للوصول إلى الإدارة." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="إدارة التطبيقات الحكومية">
        <QueryState detail="لا يملك هذا الحساب صلاحية الإدارة." type="error" />
      </Screen>
    );
  }

  return (
    <GovernmentAppsAdminContent
      access={access}
      key={`govapps:${user.id}`}
      userId={user.id}
    />
  );
}

function GovernmentAppsAdminContent({
  access,
  userId,
}: {
  access: DirectoryAdminAccess;
  userId: number;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const queryKey = ['admin', 'govapps', userId] as const;
  const query = useQuery({
    queryFn: ({ signal }) => fetchGovernmentAppsAdmin(signal),
    queryKey,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: directoryQueryKeys.governmentApps,
      }),
    ]);
  };

  const run = async (key: string, operation: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await operation();
      await refresh();
    } catch (cause) {
      Alert.alert(
        'تعذر حفظ التغيير',
        cause instanceof Error ? cause.message : 'حاول مرة أخرى.',
      );
    } finally {
      setBusy(null);
    }
  };

  const apps = query.data ?? [];
  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="التطبيقات والأيقونات وروابط التنزيل"
      title="إدارة التطبيقات الحكومية"
    >
      {query.isLoading ? (
        <AppText color="muted">جار تحميل التطبيقات...</AppText>
      ) : query.isError ? (
        <QueryState onRetry={() => void query.refetch()} type="error" />
      ) : (
        <GovernmentAppManager
          access={access}
          apps={apps}
          busy={busy}
          onDelete={(app) =>
            Alert.alert(
              'حذف التطبيق؟',
              `سيتم حذف ${app.name_ar} نهائياً.`,
              [
                { style: 'cancel', text: 'إلغاء' },
                {
                  onPress: () =>
                    void run(`delete-${app.id}`, () =>
                      deleteGovernmentApp(app.id),
                    ),
                  style: 'destructive',
                  text: 'حذف',
                },
              ],
            )
          }
          onReorder={(ids) =>
            run('reorder', () => reorderGovernmentApps(ids))
          }
          onSave={(existingId, createId, input) =>
            run(existingId ? `save-${existingId}` : 'create', () =>
              existingId
                ? updateGovernmentApp(existingId, input)
                : createGovernmentApp(createId, input),
            )
          }
          onVisibility={(app, value) =>
            run(`visibility-${app.id}`, () =>
              setGovernmentAppVisibility(app.id, value),
            )
          }
        />
      )}
    </Screen>
  );
}

export function GovernmentAppManager({
  access,
  apps,
  busy,
  onDelete,
  onReorder,
  onSave,
  onVisibility,
}: {
  access: DirectoryAdminAccess;
  apps: readonly AdminGovernmentApp[];
  busy: null | string;
  onDelete: (app: AdminGovernmentApp) => void;
  onReorder: (ids: readonly string[]) => void;
  onSave: (
    existingId: null | string,
    createId: string,
    input: GovernmentAppInput,
  ) => void;
  onVisibility: (app: AdminGovernmentApp, value: boolean) => void;
}) {
  const [editing, setEditing] = useState<AdminGovernmentApp | null>(null);
  const [id, setId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [name, setName] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [description, setDescription] = useState('');
  const [official, setOfficial] = useState('');
  const [android, setAndroid] = useState('');
  const [apple, setApple] = useState('');
  const [icon, setIcon] = useState<PickedDirectoryImage | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () => filterGovernmentApps(apps, search),
    [apps, search],
  );
  // A text search hides neighbours, so the arrows would look like they skip
  // rows; ordering stays tied to the full list the API returns.
  const canReorder = access.canReorder && !search.trim();

  const reset = () => {
    setEditing(null);
    setId('');
    setNameAr('');
    setName('');
    setDescriptionAr('');
    setDescription('');
    setOfficial('');
    setAndroid('');
    setApple('');
    setIcon(null);
    setIsActive(true);
  };

  const edit = (app: AdminGovernmentApp) => {
    setEditing(app);
    setId(app.id);
    setNameAr(app.name_ar);
    setName(app.name);
    setDescriptionAr(app.description_ar ?? '');
    setDescription(app.description ?? '');
    setOfficial(app.links.official ?? '');
    setAndroid(app.links.android ?? '');
    setApple(app.links.apple ?? '');
    setIcon(null);
    setIsActive(app.is_active);
  };

  const save = () => {
    try {
      const createId = editing ? editing.id : safeDirectoryId(id);
      const links = Object.fromEntries(
        [
          ['official', safeOptionalHttpUrl(official)],
          ['android', safeOptionalHttpUrl(android)],
          ['apple', safeOptionalHttpUrl(apple)],
        ].filter((entry): entry is [string, string] => Boolean(entry[1])),
      );
      onSave(editing?.id ?? null, createId, {
        description: cleanOptionalText(description),
        descriptionAr: cleanOptionalText(descriptionAr),
        icon,
        isActive,
        links,
        name: cleanRequiredText(name, 'الاسم بالإنجليزية'),
        nameAr: cleanRequiredText(nameAr, 'الاسم بالعربية'),
      });
      reset();
    } catch (cause) {
      Alert.alert(
        'تحقق من البيانات',
        cause instanceof Error ? cause.message : 'أكمل الحقول المطلوبة.',
      );
    }
  };

  return (
    <View style={styles.section}>
      {(editing ? access.canEdit : access.canCreate) ? (
        <AppCard style={styles.form}>
          <AppText variant="heading">
            {editing ? 'تعديل التطبيق' : 'إضافة تطبيق'}
          </AppText>
          <AppInput
            editable={!editing}
            onChangeText={setId}
            placeholder="المعرف بالإنجليزية"
            value={id}
          />
          <AppInput
            onChangeText={setNameAr}
            placeholder="الاسم بالعربية"
            value={nameAr}
          />
          <AppInput
            onChangeText={setName}
            placeholder="الاسم بالإنجليزية"
            value={name}
          />
          <AppInput
            multiline
            onChangeText={setDescriptionAr}
            placeholder="الوصف بالعربية"
            value={descriptionAr}
          />
          <AppInput
            multiline
            onChangeText={setDescription}
            placeholder="الوصف بالإنجليزية"
            value={description}
          />
          <AppInput
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={setOfficial}
            placeholder="الموقع الرسمي"
            value={official}
          />
          <AppInput
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={setAndroid}
            placeholder="رابط أندرويد"
            value={android}
          />
          <AppInput
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={setApple}
            placeholder="رابط آيفون"
            value={apple}
          />
          <DirectoryImagePickerButton image={icon} onChange={setIcon} />
          {!editing || access.canToggle ? (
            <DirectoryVisibilityField
              onChange={setIsActive}
              testID="form-visibility"
              value={isActive}
            />
          ) : null}
          <View style={styles.actions}>
            <AppButton
              loading={busy === (editing ? `save-${editing.id}` : 'create')}
              onPress={save}
            >
              حفظ
            </AppButton>
            {editing ? (
              <AppButton onPress={reset} variant="secondary">
                إلغاء
              </AppButton>
            ) : null}
          </View>
        </AppCard>
      ) : null}

      <DirectorySearchField
        accessibilityLabel="البحث في التطبيقات الحكومية"
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو المعرف"
        value={search}
      />
      <AppText color="muted" variant="caption">
        {`عرض ${visible.length} من ${apps.length} تطبيق`}
      </AppText>

      {visible.length === 0 ? (
        <AppText color="muted">لا توجد نتائج مطابقة للبحث.</AppText>
      ) : null}

      {visible.map((app) => {
        const index = apps.indexOf(app);
        return (
          <AppCard key={app.id} style={styles.item}>
            <View style={styles.heading}>
              <DirectoryImage
                accessibilityLabel={`أيقونة ${app.name_ar}`}
                style={styles.icon}
                uri={app.icon}
              />
              <View style={styles.grow}>
                <AppText variant="heading">{app.name_ar}</AppText>
                <AppText color="muted" variant="caption">
                  {app.name} · {app.id}
                </AppText>
              </View>
            </View>
            {access.canToggle ? (
              <DirectoryVisibilityField
                onChange={(value) => onVisibility(app, value)}
                testID={`toggle-${app.id}`}
                value={app.is_active}
              />
            ) : null}
            {canReorder ? (
              <DirectoryOrderActions
                busy={busy === 'reorder'}
                first={index === 0}
                last={index === apps.length - 1}
                onDown={() =>
                  onReorder(
                    moveDirectoryId(
                      apps.map(({ id: value }) => value),
                      index,
                      1,
                    ),
                  )
                }
                onUp={() =>
                  onReorder(
                    moveDirectoryId(
                      apps.map(({ id: value }) => value),
                      index,
                      -1,
                    ),
                  )
                }
              />
            ) : null}
            {access.canEdit || access.canDelete ? (
              <View style={styles.actions}>
                {access.canEdit ? (
                  <AppButton onPress={() => edit(app)} variant="secondary">
                    تعديل
                  </AppButton>
                ) : null}
                {access.canDelete ? (
                  <AppButton
                    loading={busy === `delete-${app.id}`}
                    onPress={() => onDelete(app)}
                    variant="danger"
                  >
                    حذف
                  </AppButton>
                ) : null}
              </View>
            ) : null}
          </AppCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  form: {
    gap: 12,
  },
  grow: {
    flex: 1,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  icon: {
    height: 72,
    width: 72,
  },
  item: {
    gap: 12,
  },
  section: {
    gap: 14,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/GovApps/Index.tsx (210 lines)
  confidence: high
  todos:      0
  notes:      Bearer administration covers application CRUD, R2 icons, links, visibility, and ordering, plus the web search box and application counts; the web page has no category filter here.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Admin/GovApps/_components/AppDialog.tsx (242 lines)
  confidence: high
  todos:      0
  notes:      The native administration form preserves application fields, icon upload, link editing, and validation.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Admin/GovApps/_components/SortableList.tsx (103 lines)
  confidence: high
  todos:      0
  notes:      Native application rows preserve ordered rendering, visibility, edit, delete, and move controls.
*/
