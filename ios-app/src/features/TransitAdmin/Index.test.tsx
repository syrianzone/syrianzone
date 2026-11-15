import { expect, mock, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { api } from '../../api';
import { mockNativeHosts } from '../Phonebook/test-hosts';
import type { PublishedRoute } from './model';
import type { createTransitAdminClient } from './api';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
mockNativeHosts();
mock.module('../../platform/lifecycle', () => ({ useScreenActive: () => true }));
let scope: string[] = ['aleppo'];
mock.module('../../platform/account', () => ({
  useAccount: () => ({
    ready: true,
    busy: false,
    sessionGeneration: 4,
    user: { id: 1, effective_permissions: ['transit.review_drafts'], transit_scope: scope }
  })
}));
mock.module('../../MapView', () => ({ MapView: 'map' }));
mock.module('./Import', () => ({ TransitImport: 'import' }));
mock.module('./RouteTools', () => ({ CombineSheet: 'combine', DraftReview: 'draft', RouteTools: 'tools' }));
const actualClient = await import('./api');
const hidden: PublishedRoute = {
  id: 'secret-route',
  cityId: 'aleppo',
  city: 'حلب',
  name: 'خط مخفي خاص بحلب',
  nameEn: null,
  price: null,
  oldPrice: null,
  color: 0,
  status: 'hidden',
  stopsCount: 0,
  createdAt: '2026-11-01T12:00:00Z'
};
const fakeClient: ReturnType<typeof createTransitAdminClient> = {
  ...actualClient.transitAdminClient,
  routes: async () => (scope.includes('aleppo') ? [hidden] : new Promise<PublishedRoute[]>(() => {})),
  drafts: async () => [],
  logs: async () => []
};
mock.module('./api', () => ({ ...actualClient, transitAdminClient: fakeClient }));
const { TransitAdminScreen } = await import('./Index');
const { FeatureNavigationProvider } = await import('../../platform/features');
const renderScreen = () =>
  createElement(FeatureNavigationProvider, {
    value: { open: () => {}, back: () => {} },
    children: createElement(TransitAdminScreen, { params: { tab: 'routes' } })
  });

test('same-session governorate revocation immediately hides cached private route rows before refetch', async () => {
  const warning = spyOn(console, 'error').mockImplementation(() => {}),
    cityRequest = spyOn(api, 'cities').mockResolvedValue([]);
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => {
      renderer = create(renderScreen());
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(hidden.name);
    scope = ['damascus'];
    await act(async () => {
      renderer.update(renderScreen());
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain(hidden.name);
  } finally {
    if (renderer)
      await act(async () => {
        renderer.unmount();
      });
    cityRequest.mockRestore();
    const messages = warning.mock.calls.map((call) => call[0]);
    warning.mockRestore();
    expect(messages.every((message) => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(
      true
    );
  }
});
