import { array, integer, record, text } from '../../platform/validation';
export interface NavSubcategory extends Record<string, unknown> {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: string;
  target: string;
  iconKey: string;
  iconUrl: string | null;
}
export interface NavItem extends Record<string, unknown> {
  id: string;
  title: string;
  text: string;
  subtitle: string;
  href: string;
  type: string;
  target: string;
  iconKey: string;
  iconUrl: string | null;
  image: string | null;
  isFlag: boolean;
  external: boolean;
  isInternal: boolean;
  enabled: boolean;
  showOnHome: boolean;
  showInNavbar: boolean;
  isCustom: boolean;
  surfaces: string[];
  subCategories: NavSubcategory[];
}
export interface NavigationConfig extends Record<string, unknown> {
  navbarTopCount: number;
  useSeparateNavbarOrder: boolean;
  navbarOrder: string[];
  items: NavItem[];
  version: number;
}
function nullable(value: unknown): string | null {
  return value == null || value === '' ? null : text(value);
}
function decodeSubcategory(value: unknown): NavSubcategory {
  const row = record(value);
  return {
    ...row,
    id: text(row.id),
    title: text(row.title, ''),
    subtitle: text(row.subtitle, ''),
    href: text(row.href, '/'),
    type: text(row.type, 'native'),
    target: text(row.target, ''),
    iconKey: text(row.iconKey, 'globe'),
    iconUrl: nullable(row.iconUrl),
  };
}
export function decodeItem(value: unknown): NavItem {
  const row = record(value),
    href = text(row.href, '/'),
    title = text(row.title || row.text, '');
  return {
    ...row,
    id: text(row.id),
    title,
    text: title,
    subtitle: text(row.subtitle, ''),
    href,
    type: text(row.type, row.external ? 'external' : 'web'),
    target: text(row.target || href, href),
    iconKey: text(row.iconKey, 'globe'),
    iconUrl: nullable(row.iconUrl ?? row.image),
    image: nullable(row.iconUrl ?? row.image),
    isFlag: row.isFlag === true,
    external: row.external === true,
    isInternal: row.isInternal !== false,
    enabled: row.enabled !== false,
    showOnHome: row.showOnHome !== false,
    showInNavbar: row.showInNavbar !== false,
    isCustom: row.isCustom === true,
    surfaces: array(row.surfaces ?? ['home', 'navbar', 'mobile_menu', 'mobile_home']).map((entry) =>
      text(entry),
    ),
    subCategories: array(row.subCategories ?? []).map(decodeSubcategory),
  };
}
export function decodeNavigation(value: unknown): NavigationConfig {
  const row = record(value),
    items = array(row.items).map(decodeItem),
    count = integer(row.navbarTopCount ?? 5);
  if (
    count < 1 ||
    count > 10 ||
    items.length > 100 ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new Error('إعدادات القائمة غير صالحة.');
  return {
    ...row,
    navbarTopCount: count,
    useSeparateNavbarOrder: row.useSeparateNavbarOrder === true,
    navbarOrder: array(row.navbarOrder ?? items.map((item) => item.id)).map((entry) => text(entry)),
    items,
    version: integer(row.version ?? 0),
  };
}
export function decodeNavigationPage(value: unknown): {
  navigation: NavigationConfig;
  defaults: NavigationConfig;
} {
  const row = record(value);
  return { navigation: decodeNavigation(row.navigation), defaults: decodeNavigation(row.defaults) };
}
export function committedNavigation(value: unknown): NavigationConfig {
  const row = record(value);
  if (row.status !== 'ok') throw new Error('لم يتم تأكيد حفظ القائمة.');
  return decodeNavigation(row.navigation);
}
export function newItem(id: string): NavItem {
  return {
    id,
    title: '',
    subtitle: '',
    href: '/',
    text: '',
    type: 'web',
    target: '/',
    iconKey: 'globe',
    iconUrl: null,
    image: null,
    isFlag: false,
    external: false,
    isInternal: true,
    enabled: true,
    showOnHome: true,
    showInNavbar: true,
    surfaces: ['home', 'navbar', 'mobile_menu', 'mobile_home'],
    subCategories: [],
    isCustom: true,
  };
}
export function newSubcategory(parent: NavItem, index: number): NavSubcategory {
  return {
    id: `${parent.id || 'item'}_sub_${index + 1}`,
    title: '',
    subtitle: '',
    href: parent.href || '/',
    type: 'native',
    target: '',
    iconKey: parent.iconKey,
    iconUrl: null,
  };
}
export function toggleItem(config: NavigationConfig, id: string, enabled: boolean): NavigationConfig {
  return {
    ...config,
    items: config.items.map((item) =>
      item.id === id ? { ...item, enabled, showOnHome: enabled, showInNavbar: enabled } : item,
    ),
  };
}
export function moveItem(config: NavigationConfig, id: string, offset: number): NavigationConfig {
  const items = [...config.items],
    from = items.findIndex((row) => row.id === id),
    to = from + offset,
    item = items[from];
  if (!item || to < 0 || to >= items.length) return config;
  items.splice(from, 1);
  items.splice(to, 0, item);
  return {
    ...config,
    items,
    navbarOrder: config.useSeparateNavbarOrder ? config.navbarOrder : items.map((row) => row.id),
  };
}
function validHref(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function editItem(
  config: NavigationConfig,
  previousId: string | null,
  draft: NavItem,
): NavigationConfig {
  const previous = config.items.find((item) => item.id === previousId),
    id = draft.id.trim() || draft.href.trim(),
    title = draft.title.trim();
  if (
    !title ||
    title.length > 80 ||
    !id ||
    id.length > 500 ||
    !validHref(draft.href.trim()) ||
    draft.href.length > 2048 ||
    draft.target.length > 2048 ||
    draft.subtitle.length > 200 ||
    draft.iconKey.length > 50 ||
    draft.subCategories.length > 30 ||
    config.items.some((item) => item.id === id && item.id !== previousId) ||
    (previous && !previous.isCustom && id !== previousId)
  )
    throw new Error('تحقق من العنوان والمعرّف والرابط وحدود الحقول. لا يمكن تغيير معرّف قسم أصلي.');
  if (!previous && config.items.length >= 100) throw new Error('الحد الأقصى ١٠٠ قسم.');
  const subs = draft.subCategories.filter((item) => item.title.trim());
  for (const sub of subs)
    if (
      sub.title.length > 80 ||
      sub.subtitle.length > 200 ||
      sub.id.length > 500 ||
      sub.href.length > 2048 ||
      sub.target.length > 2048 ||
      !validHref(sub.href)
    )
      throw new Error('تحقق من حقول القسم الفرعي.');
  for (const icon of [draft.iconUrl, draft.image])
    if (icon && (icon.length > 2048 || !validHref(icon))) throw new Error('رابط الأيقونة غير صالح.');
  const item = {
    ...draft,
    id,
    title,
    text: title,
    href: draft.href.trim(),
    target: (draft.target || draft.href).trim(),
    external: /^https?:\/\//i.test(draft.href) || draft.external,
    iconUrl: draft.iconUrl?.trim() || null,
    image: draft.image?.trim() || null,
    subCategories: subs,
  };
  const items = previous
    ? config.items.map((row) => (row.id === previousId ? item : row))
    : [...config.items, item];
  const navbarOrder = config.navbarOrder.map((value) => (value === previousId ? id : value));
  if (!navbarOrder.includes(id)) navbarOrder.push(id);
  return {
    ...config,
    items,
    navbarOrder: config.useSeparateNavbarOrder ? navbarOrder : items.map((row) => row.id),
  };
}
export function removeItem(config: NavigationConfig, id: string): NavigationConfig {
  if (!config.items.find((item) => item.id === id)?.isCustom) throw new Error('لا يمكن حذف قسم أصلي.');
  return {
    ...config,
    items: config.items.filter((item) => item.id !== id),
    navbarOrder: config.navbarOrder.filter((item) => item !== id),
  };
}
