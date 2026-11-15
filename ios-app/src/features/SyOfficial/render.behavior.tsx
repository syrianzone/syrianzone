import { expect, mock, spyOn, test } from 'bun:test';
import { createElement, Fragment, type ElementType, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { api, type ApiClient } from '../../api';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
mock.module('react-native', () => ({
  View: 'view', ScrollView: 'scroll', Pressable: 'pressable', Linking: { openURL: async () => {} }, Share: { share: async () => {} },
  FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: { data: unknown[]; renderItem(info: { item: unknown; index: number }): ReactNode; ListHeaderComponent: ReactNode; ListEmptyComponent?: ReactNode }) =>
    createElement('list', null, ListHeaderComponent, data.length ? data.map((item, index) => createElement(Fragment, { key: index }, renderItem({ item, index }))) : ListEmptyComponent)
}));
mock.module('../../components', () => ({ contentStyle: {}, Heading: 'heading', Label: 'label', Section: 'section', SearchField: 'search', RequestStatus: () => null }));
mock.module('../../ui/native', () => ({ NativeAction: 'button', NativeSegmented: 'segments', NativeSymbol: 'symbol' }));
mock.module('../../ui/theme', () => ({ useTheme: () => ({ colors: { text: '#000', background: '#fff', surface: '#fff', elevated: '#fff', secondary: '#666', accent: '#080', accentMuted: '#efe', separator: '#ddd' } }) }));
mock.module('expo-image', () => ({ Image: 'img' }));
mock.module('react-native-svg', () => ({ SvgXml: 'svg' }));
mock.module('../../ui/graphics', () => ({ ProjectIcon: 'icon' }));
mock.module('../../platform/lifecycle', () => ({ useScreenActive: () => true }));
const { SyOfficialScreen } = await import('./Index');
const host = (type: string): ElementType => type as ElementType;
const names = (node: ReactTestInstance) => node.findAllByType(host('label')).flatMap(label => typeof label.props.children === 'string' ? [label.props.children] : []);
const entity = (id: string, category: string, nameAr: string, name: string) => ({ id, category, name_ar: nameAr, name, description: '', description_ar: '', image: null, socials: {} });
const fixture = {
  categories: [
    { id: 'ministry', label_ar: 'وزارات', label_en: 'Ministries' },
    { id: 'agency', label_ar: 'هيئات', label_en: 'Agencies' },
    { id: 'empty', label_ar: 'تصنيف فارغ', label_en: 'Empty category' }
  ],
  initialData: [
    entity('agency-1', 'agency', 'هيئة مشتركة', 'Shared agency'),
    entity('ministry-1', 'ministry', 'وزارة مشتركة', 'Shared ministry'),
    entity('ministry-2', 'ministry', 'وزارة التعليم', 'Education ministry'),
    entity('agency-2', 'agency', 'هيئة البحث', 'Research agency'),
    entity('ministry-3', 'ministry', 'وزارة الثقافة', 'Culture ministry')
  ]
};

test('the rendered official grid keeps source category order, headings and two-card rows through filtering and language changes', async () => {
  const read: ApiClient['page'] = async (_path, _component, decode) => decode(fixture);
  const page = spyOn(api, 'page').mockImplementation(read), warning = spyOn(console, 'error').mockImplementation(() => {});
  let mounted: ReactTestRenderer | undefined;
  try {
    await act(async () => { mounted = create(createElement(SyOfficialScreen, { params: {} })); });
    const root = () => mounted!.root;
    const headings = () => root().findAll(node => node.props.accessibilityRole === 'header').map(node => node.props.accessibilityLabel ?? node.props.children);
    const accountNames = new Set(fixture.initialData.flatMap(item => [item.name_ar, item.name]));
    const cards = () => root().findAllByType(host('section')).map(names).map(labels => labels[0]).filter(name => accountNames.has(name ?? ''));
    const rows = () => root().findAll(node => node.type === 'view' && node.props.style?.flexDirection === 'row' && node.findAllByType(host('section')).length > 0)
      .map(row => row.findAllByType(host('section')).map(card => names(card)[0]));
    const category = (title: string) => root().findAllByType(host('pressable')).find(node => names(node).includes(title))!;
    expect(headings()).toEqual(['وزارات', 'هيئات']);
    expect(rows()).toEqual([['وزارة مشتركة', 'وزارة التعليم'], ['وزارة الثقافة'], ['هيئة مشتركة', 'هيئة البحث']]);
    expect(headings()).not.toContain('تصنيف فارغ');
    await act(async () => category('وزارات').props.onPress());
    expect(headings()).toEqual(['وزارات']);
    expect(cards()).toEqual(['وزارة مشتركة', 'وزارة التعليم', 'وزارة الثقافة']);
    await act(async () => root().findByProps({ accessibilityLabel: 'English' }).props.onPress());
    expect(headings()).toEqual(['Ministries']);
    expect(cards()).toEqual(['Shared ministry', 'Education ministry', 'Culture ministry']);
    await act(async () => category('Ministries').props.onPress());
    expect(headings()).toEqual(['Ministries', 'Agencies']);
    await act(async () => root().findByType(host('search')).props.onChange('shared'));
    expect(headings()).toEqual(['Ministries', 'Agencies']);
    expect(rows()).toEqual([['Shared ministry'], ['Shared agency']]);
    await act(async () => root().findByType(host('segments')).props.onChange('table'));
    expect(headings()).toEqual([]);
    expect(cards()).toEqual(['Shared agency', 'Shared ministry']);
    await act(async () => root().findByType(host('segments')).props.onChange('grid'));
    await act(async () => root().findByType(host('search')).props.onChange('missing account'));
    expect(headings()).toEqual([]);
    expect(cards()).toEqual([]);
    expect(JSON.stringify(mounted!.toJSON())).toContain('No official accounts found');
  } finally {
    if (mounted) await act(async () => mounted?.unmount());
    page.mockRestore();
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});

test('Arabic official cards retain the source English description fallback in grid and table views', async () => {
  const descriptions = { ...fixture, initialData: [
    { ...entity('fallback', 'ministry', 'جهة بوصف بديل', 'Fallback entity'), description: 'Public description retained' },
    { ...entity('translated', 'ministry', 'جهة بوصف عربي', 'Translated entity'), description: 'English description', description_ar: 'الوصف العربي المقدم' }
  ] };
  const read: ApiClient['page'] = async (_path, _component, decode) => decode(descriptions);
  const page = spyOn(api, 'page').mockImplementation(read), warning = spyOn(console, 'error').mockImplementation(() => {});
  let mounted: ReactTestRenderer | undefined;
  try {
    await act(async () => { mounted = create(createElement(SyOfficialScreen, { params: {} })); });
    const labels = () => mounted!.root.findAllByType(host('section')).flatMap(names);
    expect(labels()).toContain('Public description retained');
    expect(labels()).toContain('الوصف العربي المقدم');
    expect(labels()).not.toContain('English description');
    await act(async () => mounted!.root.findByType(host('segments')).props.onChange('table'));
    expect(labels()).toContain('Public description retained');
    expect(labels()).toContain('الوصف العربي المقدم');
    for (const language of ['English', 'Türkçe', 'Kurdî']) {
      await act(async () => mounted!.root.findByProps({ accessibilityLabel: language }).props.onPress());
      expect(labels()).toContain('Public description retained');
      expect(labels()).toContain('English description');
      expect(labels()).not.toContain('الوصف العربي المقدم');
    }
  } finally {
    if (mounted) await act(async () => mounted?.unmount());
    page.mockRestore();
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});
