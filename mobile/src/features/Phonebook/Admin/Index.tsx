import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  cleanOptionalText,
  cleanRequiredText,
  type DirectoryAdminAccess,
  DirectoryOrderActions,
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
  createPhonebookCategory,
  createPhonebookEntry,
  deletePhonebookCategory,
  deletePhonebookEntry,
  fetchPhonebookAdmin,
  type AdminPhonebookCategory,
  type AdminPhonebookEntry,
  type PhonebookCategoryInput,
  type PhonebookEntryInput,
  reorderPhonebookCategories,
  reorderPhonebookEntries,
  setPhonebookEntryVisibility,
  updatePhonebookCategory,
  updatePhonebookEntry,
} from '@/lib/api/directories/admin';

export function getPhonebookAdminAccess(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
) {
  return getDirectoryAdminAccess(user, 'phonebook', 'phonebook_admin');
}

export function canManagePhonebook(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
): boolean {
  return hasDirectoryAdminAccess(getPhonebookAdminAccess(user));
}

export default function PhonebookAdminScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const access = getPhonebookAdminAccess(user);
  const permitted = hasDirectoryAdminAccess(access);

  if (authLoading) {
    return (
      <Screen title="إدارة دليل الهاتف">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="إدارة دليل الهاتف">
        <QueryState detail="سجل الدخول للوصول إلى الإدارة." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="إدارة دليل الهاتف">
        <QueryState detail="لا يملك هذا الحساب صلاحية الإدارة." type="error" />
      </Screen>
    );
  }

  return (
    <PhonebookAdminContent
      access={access}
      key={`phonebook:${user.id}`}
      userId={user.id}
    />
  );
}

function PhonebookAdminContent({
  access,
  userId,
}: {
  access: DirectoryAdminAccess;
  userId: number;
}) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<'categories' | 'entries'>('entries');
  const [busy, setBusy] = useState<string | null>(null);
  const queryKey = ['admin', 'phonebook', userId] as const;
  const query = useQuery({
    queryFn: ({ signal }) => fetchPhonebookAdmin(signal),
    queryKey,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: directoryQueryKeys.phonebook }),
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

  const categories = query.data?.categories ?? [];
  const entries = query.data?.entries ?? [];
  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="الفئات والأرقام وروابط المصدر"
      title="إدارة دليل الهاتف"
    >
      <View style={styles.tabs}>
        <AppButton
          onPress={() => setSection('entries')}
          variant={section === 'entries' ? 'primary' : 'secondary'}
        >
          الأرقام
        </AppButton>
        <AppButton
          onPress={() => setSection('categories')}
          variant={section === 'categories' ? 'primary' : 'secondary'}
        >
          الفئات
        </AppButton>
      </View>

      {query.isLoading ? (
        <AppText color="muted">جار تحميل الدليل...</AppText>
      ) : query.isError ? (
        <QueryState onRetry={() => void query.refetch()} type="error" />
      ) : section === 'categories' ? (
        <PhonebookCategoryManager
          access={access}
          busy={busy}
          categories={categories}
          onDelete={(category) =>
            Alert.alert(
              'حذف الفئة؟',
              `سيتم حذف ${category.label_ar}.`,
              [
                { style: 'cancel', text: 'إلغاء' },
                {
                  onPress: () =>
                    void run(`delete-category-${category.id}`, () =>
                      deletePhonebookCategory(category.id),
                    ),
                  style: 'destructive',
                  text: 'حذف',
                },
              ],
            )
          }
          onReorder={(ids) =>
            run('reorder-categories', () =>
              reorderPhonebookCategories(ids),
            )
          }
          onSave={(existingId, input) =>
            run(existingId ? `category-${existingId}` : 'new-category', () =>
              existingId
                ? updatePhonebookCategory(existingId, input)
                : createPhonebookCategory(input),
            )
          }
        />
      ) : (
        <PhonebookEntryManager
          access={access}
          busy={busy}
          categories={categories}
          entries={entries}
          onDelete={(entry) =>
            Alert.alert(
              'حذف الرقم؟',
              `سيتم حذف ${entry.name_ar}.`,
              [
                { style: 'cancel', text: 'إلغاء' },
                {
                  onPress: () =>
                    void run(`delete-entry-${entry.id}`, () =>
                      deletePhonebookEntry(entry.id),
                    ),
                  style: 'destructive',
                  text: 'حذف',
                },
              ],
            )
          }
          onReorder={(ids) =>
            run('reorder-entries', () => reorderPhonebookEntries(ids))
          }
          onSave={(existingId, input) =>
            run(existingId ? `entry-${existingId}` : 'new-entry', () =>
              existingId
                ? updatePhonebookEntry(existingId, input)
                : createPhonebookEntry(input),
            )
          }
          onVisibility={(entry, value) =>
            run(`visibility-${entry.id}`, () =>
              setPhonebookEntryVisibility(entry.id, value),
            )
          }
        />
      )}
    </Screen>
  );
}

function PhonebookCategoryManager({
  access,
  busy,
  categories,
  onDelete,
  onReorder,
  onSave,
}: {
  access: DirectoryAdminAccess;
  busy: null | string;
  categories: readonly AdminPhonebookCategory[];
  onDelete: (category: AdminPhonebookCategory) => void;
  onReorder: (ids: readonly string[]) => void;
  onSave: (existingId: null | string, input: PhonebookCategoryInput) => void;
}) {
  const [editing, setEditing] = useState<AdminPhonebookCategory | null>(null);
  const [id, setId] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [icon, setIcon] = useState('');
  const [isActive, setIsActive] = useState(true);

  const reset = () => {
    setEditing(null);
    setId('');
    setLabelAr('');
    setLabelEn('');
    setIcon('');
    setIsActive(true);
  };

  const edit = (category: AdminPhonebookCategory) => {
    setEditing(category);
    setId(category.id);
    setLabelAr(category.label_ar);
    setLabelEn(category.label_en);
    setIcon(category.icon ?? '');
    setIsActive(category.is_active);
  };

  const save = () => {
    try {
      onSave(editing?.id ?? null, {
        icon: cleanOptionalText(icon),
        id: editing ? undefined : safeDirectoryId(id),
        isActive,
        labelAr: cleanRequiredText(labelAr, 'اسم الفئة بالعربية'),
        labelEn: cleanRequiredText(labelEn, 'اسم الفئة بالإنجليزية'),
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
          {editing ? 'تعديل الفئة' : 'إضافة فئة'}
        </AppText>
        <AppInput
          editable={!editing}
          onChangeText={setId}
          placeholder="المعرف بالإنجليزية"
          value={id}
        />
        <AppInput
          onChangeText={setLabelAr}
          placeholder="الاسم بالعربية"
          value={labelAr}
        />
        <AppInput
          onChangeText={setLabelEn}
          placeholder="الاسم بالإنجليزية"
          value={labelEn}
        />
        <AppInput
          onChangeText={setIcon}
          placeholder="رمز الأيقونة، اختياري"
          value={icon}
        />
        <DirectoryVisibilityField onChange={setIsActive} value={isActive} />
        <View style={styles.actions}>
          <AppButton
            loading={busy === (editing ? `category-${editing.id}` : 'new-category')}
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

      {categories.map((category, index) => (
        <AppCard key={category.id} style={styles.item}>
          <View style={styles.heading}>
            <View style={styles.grow}>
              <AppText variant="heading">{category.label_ar}</AppText>
              <AppText color="muted" variant="caption">
                {category.label_en} · {category.id}
              </AppText>
            </View>
            <AppText color={category.is_active ? 'success' : 'muted'}>
              {category.is_active ? 'ظاهر' : 'مخفي'}
            </AppText>
          </View>
          {access.canReorder ? (
            <DirectoryOrderActions
              busy={busy === 'reorder-categories'}
              first={index === 0}
              last={index === categories.length - 1}
              onDown={() =>
                onReorder(
                  moveDirectoryId(
                    categories.map(({ id: value }) => value),
                    index,
                    1,
                  ),
                )
              }
              onUp={() =>
                onReorder(
                  moveDirectoryId(
                    categories.map(({ id: value }) => value),
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
                <AppButton
                  onPress={() => edit(category)}
                  variant="secondary"
                >
                  تعديل
                </AppButton>
              ) : null}
              {access.canDelete ? (
                <AppButton
                  loading={busy === `delete-category-${category.id}`}
                  onPress={() => onDelete(category)}
                  variant="danger"
                >
                  حذف
                </AppButton>
              ) : null}
            </View>
          ) : null}
        </AppCard>
      ))}
    </View>
  );
}

export function PhonebookEntryManager({
  access,
  busy,
  categories,
  entries,
  onDelete,
  onReorder,
  onSave,
  onVisibility,
}: {
  access: DirectoryAdminAccess;
  busy: null | string;
  categories: readonly AdminPhonebookCategory[];
  entries: readonly AdminPhonebookEntry[];
  onDelete: (entry: AdminPhonebookEntry) => void;
  onReorder: (ids: readonly string[]) => void;
  onSave: (existingId: null | string, input: PhonebookEntryInput) => void;
  onVisibility: (entry: AdminPhonebookEntry, value: boolean) => void;
}) {
  const [editing, setEditing] = useState<AdminPhonebookEntry | null>(null);
  const [id, setId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [number, setNumber] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isWhatsapp, setIsWhatsapp] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const activeCategory = categoryId || categories[0]?.id || '';

  const reset = () => {
    setEditing(null);
    setId('');
    setCategoryId(categories[0]?.id ?? '');
    setNameAr('');
    setNameEn('');
    setNumber('');
    setSourceUrl('');
    setIsWhatsapp(false);
    setIsActive(true);
  };

  const edit = (entry: AdminPhonebookEntry) => {
    setEditing(entry);
    setId(entry.id);
    setCategoryId(entry.category_id);
    setNameAr(entry.name_ar);
    setNameEn(entry.name_en ?? '');
    setNumber(entry.number);
    setSourceUrl(entry.source_url ?? '');
    setIsWhatsapp(entry.is_whatsapp);
    setIsActive(entry.is_active);
  };

  const save = () => {
    try {
      onSave(editing?.id ?? null, {
        categoryId: cleanRequiredText(activeCategory, 'الفئة'),
        id: editing ? undefined : id.trim() ? safeDirectoryId(id) : undefined,
        isActive,
        isWhatsapp,
        nameAr: cleanRequiredText(nameAr, 'اسم الجهة'),
        nameEn: cleanOptionalText(nameEn),
        number: cleanRequiredText(number, 'رقم الهاتف'),
        sourceUrl: safeOptionalHttpUrl(sourceUrl),
      });
      reset();
    } catch (cause) {
      Alert.alert(
        'تحقق من البيانات',
        cause instanceof Error ? cause.message : 'أكمل الحقول المطلوبة.',
      );
    }
  };

  const categoryNames = useMemo(
    () =>
      new Map(categories.map((category) => [category.id, category.label_ar])),
    [categories],
  );

  return (
    <View style={styles.section}>
      {(editing ? access.canEdit : access.canCreate) ? (
        <AppCard style={styles.form}>
        <AppText variant="heading">
          {editing ? 'تعديل الرقم' : 'إضافة رقم'}
        </AppText>
        <AppInput
          editable={!editing}
          onChangeText={setId}
          placeholder="معرف اختياري"
          value={id}
        />
        <AppText variant="label">الفئة</AppText>
        <View style={styles.chips}>
          {categories.map((category) => (
            <AppButton
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              variant={
                activeCategory === category.id ? 'primary' : 'secondary'
              }
            >
              {category.label_ar}
            </AppButton>
          ))}
        </View>
        <AppInput
          onChangeText={setNameAr}
          placeholder="اسم الجهة بالعربية"
          value={nameAr}
        />
        <AppInput
          onChangeText={setNameEn}
          placeholder="اسم الجهة بالإنجليزية"
          value={nameEn}
        />
        <AppInput
          keyboardType="phone-pad"
          onChangeText={setNumber}
          placeholder="رقم الهاتف"
          value={number}
        />
        <AppInput
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={setSourceUrl}
          placeholder="رابط المصدر"
          value={sourceUrl}
        />
        <DirectoryVisibilityField
          label="يدعم واتساب"
          onChange={setIsWhatsapp}
          value={isWhatsapp}
        />
        {!editing || access.canToggle ? (
          <DirectoryVisibilityField
            onChange={setIsActive}
            testID="form-visibility"
            value={isActive}
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton
            loading={busy === (editing ? `entry-${editing.id}` : 'new-entry')}
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

      {entries.map((entry, index) => (
        <AppCard key={entry.id} style={styles.item}>
          <View style={styles.heading}>
            <View style={styles.grow}>
              <AppText variant="heading">{entry.name_ar}</AppText>
              <AppText color="muted" variant="caption">
                {categoryNames.get(entry.category_id) ?? entry.category_id}
              </AppText>
              <AppText>{entry.number}</AppText>
            </View>
            {entry.is_whatsapp ? (
              <AppText color="success" variant="caption">
                واتساب
              </AppText>
            ) : null}
          </View>
          {access.canToggle ? (
            <DirectoryVisibilityField
              onChange={(value) => onVisibility(entry, value)}
              testID={`toggle-${entry.id}`}
              value={entry.is_active}
            />
          ) : null}
          {access.canReorder ? (
            <DirectoryOrderActions
              busy={busy === 'reorder-entries'}
              first={index === 0}
              last={index === entries.length - 1}
              onDown={() =>
                onReorder(
                  moveDirectoryId(
                    entries.map(({ id: value }) => value),
                    index,
                    1,
                  ),
                )
              }
              onUp={() =>
                onReorder(
                  moveDirectoryId(
                    entries.map(({ id: value }) => value),
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
                <AppButton
                  onPress={() => edit(entry)}
                  variant="secondary"
                >
                  تعديل
                </AppButton>
              ) : null}
              {access.canDelete ? (
                <AppButton
                  loading={busy === `delete-entry-${entry.id}`}
                  onPress={() => onDelete(entry)}
                  variant="danger"
                >
                  حذف
                </AppButton>
              ) : null}
            </View>
          ) : null}
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chips: {
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
    gap: 10,
  },
  item: {
    gap: 12,
  },
  section: {
    gap: 14,
  },
  tabs: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Phonebook/Index.tsx (518 lines)
  confidence: high
  todos:      0
  notes:      Bearer administration covers categories, entries, WhatsApp metadata, sources, visibility, and ordering.
*/
