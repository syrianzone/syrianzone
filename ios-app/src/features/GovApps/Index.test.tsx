import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { api, type ApiClient } from '../../api';
import type { FeatureScreenProps } from '../../platform/features';
import { mockNativeHosts } from '../Phonebook/test-hosts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
mockNativeHosts();
mock.module('expo-image', () => ({ Image: 'img' }));
mock.module('../../ui/graphics', () => ({ ProjectIcon: 'icon' }));
mock.module('../../platform/lifecycle', () => ({ useScreenActive: () => true }));
const { GovAppsScreen } = await import('./Index');
let mounted: ReactTestRenderer | undefined;
afterEach(async () => { if (mounted) await act(async () => mounted?.unmount()); mounted = undefined; });

test('a Home search destination immediately applies the passed GovApps query', async () => {
  const fixture = { initialData: [
    { id: 'foreign', name: 'وزارة الخارجية', links: { official: 'https://example.test/foreign' }, images: [] },
    { id: 'water', name: 'خدمة المياه', links: { official: 'https://example.test/water' }, images: [] }
  ] };
  const read: ApiClient['page'] = async (_path, _component, decode) => decode(fixture);
  const page = spyOn(api, 'page').mockImplementation(read), warning = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const Screen = GovAppsScreen as ComponentType<FeatureScreenProps>;
    await act(async () => { mounted = create(createElement(Screen, { params: { id: 'foreign', q: 'الخارجية' } })); });
    expect(mounted!.root.findByType('search').props.value).toBe('الخارجية');
    expect(JSON.stringify(mounted!.toJSON())).toContain('وزارة الخارجية');
    expect(JSON.stringify(mounted!.toJSON())).not.toContain('خدمة المياه');
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  } finally { page.mockRestore(); warning.mockRestore(); }
});
