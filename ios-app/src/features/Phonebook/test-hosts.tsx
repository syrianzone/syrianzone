import { mock } from 'bun:test';
import { createElement, Fragment, type ReactNode } from 'react';

let fieldObserver: (value: string) => void = () => {};
export function observeFields(observer: (value: string) => void): void { fieldObserver = observer; }
export function mockNativeHosts(): void {
  mock.module('react-native', () => ({
    View: 'view', TextInput: 'input', ScrollView: 'scroll', Pressable: 'pressable', Modal: 'dialog',
    AccessibilityInfo: { announceForAccessibility: () => {} }, Alert: { alert: () => {} },
    Linking: { openURL: async () => {} }, Share: { share: async () => {} },
    FlatList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent }: { data: unknown[]; renderItem(info: { item: unknown; index: number }): ReactNode; ListHeaderComponent: ReactNode; ListFooterComponent?: ReactNode }) => createElement('list', null, ListHeaderComponent, ...data.map((item, index) => createElement(Fragment, { key: index }, renderItem({ item, index }))), ListFooterComponent)
  }));
  mock.module('../../components', () => ({
    contentStyle: {}, AdaptivePanes: ({ primary }: { primary: ReactNode }) => createElement('panes', null, primary),
    EmptyState: 'empty', FormField: (props: { value: string }) => { fieldObserver(props.value); return createElement('input', props); },
    Heading: 'heading', Label: 'label', Photo: 'img', RequestStatus: () => null, SearchField: 'search', Section: 'section', Row: 'row'
  }));
  mock.module('../../ui/native', () => ({ NativeAction: 'button', NativeIconAction: 'iconbutton', NativePicker: 'select', NativeSegmented: 'segments', NativeToggle: 'toggle', NativeSymbol: 'symbol', NativeThemeHost: 'theme' }));
  mock.module('../../ui/theme', () => ({ useTheme: () => ({ mode: 'light', colors: { text: '#000', danger: '#c00', success: '#080', background: '#fff', surface: '#fff', elevated: '#fff', separator: '#ddd', secondary: '#666', accent: '#080', accentMuted: '#efe' } }) }));
}
