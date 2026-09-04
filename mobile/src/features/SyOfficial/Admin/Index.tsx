import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  cleanOptionalText,
  cleanRequiredText,
  type DirectoryAdminAccess,
  DirectoryFilterChips,
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
  createOfficialCategory,
  createOfficialEntity,
  deleteOfficialCategory,
  deleteOfficialEntity,
  fetchOfficialAdmin,
  type AdminOfficialCategory,
  type AdminOfficialEntity,
  type OfficialCategoryInput,
  type OfficialEntityInput,
  type PickedDirectoryImage,
  reorderOfficialCategories,
  reorderOfficialEntities,
  setOfficialEntityVisibility,
  updateOfficialCategory,
  updateOfficialEntity,
} from '@/lib/api/directories/admin';

import {
  ALL_OFFICIAL_CATEGORIES,
  filterAdminOfficialEntities,
  officialCategoryOptions,
  officialEntityOrders,
} from './model';

const SOCIAL_FIELDS = [
  'website',
  'facebook',
  'facebook_secondary',
  'twitter',
  'twitter_secondary',
  'instagram',
  'instagram_secondary',
  'telegram',
  'telegram_secondary',
  'linkedin',
  'youtube',
  'whatsapp',
] as const;

export function getSyOfficialAdminAccess(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
) {
  return getDirectoryAdminAccess(
    user,
    'syofficial',
    'syofficial_admin',
  );
}

export function canManageSyOfficial(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
): boolean {
  return hasDirectoryAdminAccess(getSyOfficialAdminAccess(user));
}

export default function SyOfficialAdminScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const access = getSyOfficialAdminAccess(user);
  const permitted = hasDirectoryAdminAccess(access);

  if (authLoading) {
    return (
      <Screen title="إدارة الحسابات الرسمية">
        <AppText color="muted">جار التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="إدارة الحسابات الرسمية">
        <QueryState detail="سجل الدخول للوصول إلى الإدارة." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="إدارة الحسابات الرسمية">
        <QueryState detail="لا يملك هذا الحساب صلاحية الإدارة." type="error" />
      </Screen>
    );
  }

  return (
    <SyOfficialAdminContent
      access={access}
      key={`syofficial:${user.id}`}
      userId={user.id}
    />
  );
}

function SyOfficialAdminContent({
  access,
  userId,
}: {
  access: DirectoryAdminAccess;
  userId: number;
}) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<'categories' | 'entities'>(
    'entities',
  );
  const [busy, setBusy] = useState<string | null>(null);
  const queryKey = ['admin', 'syofficial', userId] as const;
  const query = useQuery({
    queryFn: ({ signal }) => fetchOfficialAdmin(signal),
    queryKey,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: directoryQueryKeys.officialAccounts,
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

  const categories = query.data?.categories ?? [];
  const entities = query.data?.entities ?? [];

  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="الفئات والجهات والصور وروابط التواصل"
      title="إدارة الحسابات الرسمية"
    >
      <View style={styles.tabs}>
        <AppButton
          onPress={() => setSection('entities')}
          variant={section === 'entities' ? 'primary' : 'secondary'}
        >
          الجهات
        </AppButton>
        <AppButton
          onPress={() => setSection('categories')}
          variant={section === 'categories' ? 'primary' : 'secondary'}
        >
          الفئات
        </AppButton>
      </View>

      {query.isLoading ? (
        <AppText color="muted">جار تحميل البيانات...</AppText>
      ) : query.isError ? (
        <QueryState onRetry={() => void query.refetch()} type="error" />
      ) : section === 'categories' ? (
        <OfficialCategoryManager
          access={access}
          busy={busy}
          categories={categories}
          onDelete={(category) =>
            confirmDelete(
              'حذف الفئة؟',
              `سيتم حذف ${category.label_ar}.`,
              () =>
                run(`delete-category-${category.id}`, () =>
                  deleteOfficialCategory(category.id),
                ),
            )
          }
          onReorder={(ids) =>
            run('reorder-categories', () =>
              reorderOfficialCategories(ids),
            )
          }
          onSave={(id, input) =>
            run(id ? `category-${id}` : 'new-category', () =>
              id
                ? updateOfficialCategory(id, input)
                : createOfficialCategory(input),
            )
          }
        />
      ) : (
        <OfficialEntityManager
          access={access}
          busy={busy}
          categories={categories}
          entities={entities}
          onDelete={(entity) =>
            confirmDelete(
              'حذف الجهة؟',
              `سيتم حذف ${entity.name_ar} نهائياً.`,
              () =>
                run(`delete-entity-${entity.id}`, () =>
                  deleteOfficialEntity(entity.id),
                ),
            )
          }
          onReorder={(ids) =>
            run('reorder-entities', () => reorderOfficialEntities(ids))
          }
          onSave={(id, createId, input) =>
            run(id ? `entity-${id}` : 'new-entity', () =>
              id
                ? updateOfficialEntity(id, input)
                : createOfficialEntity(createId, input),
            )
          }
          onVisibility={(entity, isActive) =>
            run(`visibility-${entity.id}`, () =>
              setOfficialEntityVisibility(entity.id, isActive),
            )
          }
        />
      )}
    </Screen>
  );
}

function confirmDelete(
  title: string,
  message: string,
  onConfirm: () => void,
) {
  Alert.alert(title, message, [
    { style: 'cancel', text: 'إلغاء' },
    { onPress: onConfirm, style: 'destructive', text: 'حذف' },
  ]);
}

function OfficialCategoryManager({
  access,
  busy,
  categories,
  onDelete,
  onReorder,
  onSave,
}: {
  access: DirectoryAdminAccess;
  busy: null | string;
  categories: readonly AdminOfficialCategory[];
  onDelete: (category: AdminOfficialCategory) => void;
  onReorder: (ids: readonly string[]) => void;
  onSave: (id: null | string, input: OfficialCategoryInput) => void;
}) {
  const [editing, setEditing] = useState<AdminOfficialCategory | null>(null);
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

  const edit = (category: AdminOfficialCategory) => {
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
          autoCapitalize="words"
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

      <AppText color="muted" variant="caption">
        {`${categories.length} فئة`}
      </AppText>

      {categories.map((category, index) => (
        <AppCard key={category.id} style={styles.item}>
          <View style={styles.headingRow}>
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

export function OfficialEntityManager({
  access,
  busy,
  categories,
  entities,
  onDelete,
  onReorder,
  onSave,
  onVisibility,
}: {
  access: DirectoryAdminAccess;
  busy: null | string;
  categories: readonly AdminOfficialCategory[];
  entities: readonly AdminOfficialEntity[];
  onDelete: (entity: AdminOfficialEntity) => void;
  onReorder: (ids: readonly string[]) => void;
  onSave: (
    id: null | string,
    createId: string,
    input: OfficialEntityInput,
  ) => void;
  onVisibility: (entity: AdminOfficialEntity, isActive: boolean) => void;
}) {
  const [editing, setEditing] = useState<AdminOfficialEntity | null>(null);
  const [id, setId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [nameAr, setNameAr] = useState('');
  const [name, setName] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<PickedDirectoryImage | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(
    ALL_OFFICIAL_CATEGORIES,
  );
  const activeCategory = categoryId || categories[0]?.id || '';

  const reset = () => {
    setEditing(null);
    setId('');
    setCategoryId(categories[0]?.id ?? '');
    setNameAr('');
    setName('');
    setDescriptionAr('');
    setDescription('');
    setImage(null);
    setIsActive(true);
    setSocials({});
  };

  const edit = (entity: AdminOfficialEntity) => {
    setEditing(entity);
    setId(entity.id);
    setCategoryId(entity.category_id);
    setNameAr(entity.name_ar);
    setName(entity.name);
    setDescriptionAr(entity.description_ar ?? '');
    setDescription(entity.description ?? '');
    setImage(null);
    setIsActive(entity.is_active);
    setSocials(entity.socials);
  };

  const save = () => {
    try {
      const safeSocials = Object.fromEntries(
        SOCIAL_FIELDS.flatMap((platform) => {
          const url = safeOptionalHttpUrl(socials[platform] ?? '');
          return url ? [[platform, url]] : [];
        }),
      );
      const safeId = editing ? editing.id : safeDirectoryId(id);
      const input: OfficialEntityInput = {
        categoryId: cleanRequiredText(activeCategory, 'الفئة'),
        description: cleanOptionalText(description),
        descriptionAr: cleanOptionalText(descriptionAr),
        image,
        isActive,
        name: cleanRequiredText(name, 'الاسم بالإنجليزية'),
        nameAr: cleanRequiredText(nameAr, 'الاسم بالعربية'),
        socials: safeSocials,
      };
      onSave(editing?.id ?? null, safeId, input);
      reset();
    } catch (cause) {
      Alert.alert(
        'تحقق من البيانات',
        cause instanceof Error ? cause.message : 'أكمل الحقول المطلوبة.',
      );
    }
  };

  const categoryName = useMemo(
    () =>
      new Map(categories.map((category) => [category.id, category.label_ar])),
    [categories],
  );
  const categoryOptions = useMemo(
    () => officialCategoryOptions(categories, entities),
    [categories, entities],
  );
  const visible = useMemo(
    () =>
      filterAdminOfficialEntities(entities, {
        categoryId: categoryFilter,
        search,
      }),
    [categoryFilter, entities, search],
  );
  // Orders come from the unfiltered list so an arrow press keeps moving an
  // entity through its whole category, not just the rows currently on screen.
  const orders = useMemo(() => officialEntityOrders(entities), [entities]);
  // A text search hides siblings, so the arrows would look like they skip rows.
  const canReorder = access.canReorder && !search.trim();

  return (
    <View style={styles.section}>
      {(editing ? access.canEdit : access.canCreate) ? (
        <AppCard style={styles.form}>
        <AppText variant="heading">
          {editing ? 'تعديل الجهة' : 'إضافة جهة'}
        </AppText>
        <AppInput
          editable={!editing}
          onChangeText={setId}
          placeholder="المعرف بالإنجليزية"
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
        <DirectoryImagePickerButton image={image} onChange={setImage} />
        <AppText variant="label">روابط التواصل</AppText>
        {SOCIAL_FIELDS.map((platform) => (
          <AppInput
            autoCapitalize="none"
            keyboardType="url"
            key={platform}
            onChangeText={(value) =>
              setSocials((current) => ({ ...current, [platform]: value }))
            }
            placeholder={platform}
            value={socials[platform] ?? ''}
          />
        ))}
        {!editing || access.canToggle ? (
          <DirectoryVisibilityField
            onChange={setIsActive}
            testID="form-visibility"
            value={isActive}
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton
            loading={busy === (editing ? `entity-${editing.id}` : 'new-entity')}
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
        accessibilityLabel="البحث في الجهات الرسمية"
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو المعرف"
        value={search}
      />
      <DirectoryFilterChips
        label="الفئة"
        onSelect={setCategoryFilter}
        options={categoryOptions}
        selected={categoryFilter}
      />
      <AppText color="muted" variant="caption">
        {`عرض ${visible.length} من ${entities.length} جهة`}
      </AppText>

      {visible.length === 0 ? (
        <AppText color="muted">لا توجد نتائج مطابقة للبحث.</AppText>
      ) : null}

      {visible.map((entity) => {
        const order = orders.get(entity.id);
        return (
          <AppCard key={entity.id} style={styles.item}>
            <View style={styles.entityRow}>
              <DirectoryImage
                accessibilityLabel={`صورة ${entity.name_ar}`}
                style={styles.thumbnail}
                uri={entity.image}
              />
              <View style={styles.grow}>
                <AppText variant="heading">{entity.name_ar}</AppText>
                <AppText color="muted" variant="caption">
                  {categoryName.get(entity.category_id) ?? entity.category_id}
                </AppText>
              </View>
            </View>
            {access.canToggle ? (
              <DirectoryVisibilityField
                onChange={(value) => onVisibility(entity, value)}
                testID={`toggle-${entity.id}`}
                value={entity.is_active}
              />
            ) : null}
            {canReorder && order ? (
              <DirectoryOrderActions
                busy={busy === 'reorder-entities'}
                first={order.index === 0}
                last={order.index === order.siblings.length - 1}
                onDown={() =>
                  onReorder(moveDirectoryId(order.siblings, order.index, 1))
                }
                onUp={() =>
                  onReorder(moveDirectoryId(order.siblings, order.index, -1))
                }
              />
            ) : null}
            {access.canEdit || access.canDelete ? (
              <View style={styles.actions}>
                {access.canEdit ? (
                  <AppButton
                    onPress={() => edit(entity)}
                    variant="secondary"
                  >
                    تعديل
                  </AppButton>
                ) : null}
                {access.canDelete ? (
                  <AppButton
                    loading={busy === `delete-entity-${entity.id}`}
                    onPress={() => onDelete(entity)}
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
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  form: {
    gap: 12,
  },
  grow: {
    flex: 1,
  },
  headingRow: {
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
  thumbnail: {
    height: 72,
    width: 72,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/SyOfficial/Index.tsx (399 lines)
  confidence: high
  todos:      0
  notes:      Bearer administration covers categories, entities, R2 images, secondary social links, visibility, ordering, plus the web search box, category filter, and entity counts.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Admin/SyOfficial/_components/CategoryDialog.tsx (133 lines)
  confidence: high
  todos:      0
  notes:      The native category form preserves localized names, visibility, creation, and editing validation.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Admin/SyOfficial/_components/EntityDialog.tsx (335 lines)
  confidence: high
  todos:      0
  notes:      The native entity form preserves localized fields, category, image upload, social links, and validation.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Admin/SyOfficial/_components/SortableList.tsx (105 lines)
  confidence: high
  todos:      0
  notes:      Native official-account rows preserve ordered rendering, visibility, edit, delete, and move controls; moves stay inside the entity category like the web sorting tab, and hide while a text search narrows the list.
*/
