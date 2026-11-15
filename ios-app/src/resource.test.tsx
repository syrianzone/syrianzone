import { afterEach, beforeEach, expect, mock, spyOn, test, type Mock } from 'bun:test';
import { createElement, useSyncExternalStore } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Page } from './domain';
import { ApiError } from './api';

let active = true;
const listeners = new Set<() => void>();
mock.module('./platform/lifecycle', () => ({
  useScreenActive: () => useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback); }, () => active, () => active)
}));
const { useResource } = await import('./resource');
const { usePages } = await import('./platform/usePages');
type Snapshot = { data: string | null; error: string | null; loading: boolean };
type Loader = (signal: AbortSignal) => Promise<string>;
const mounted: ReactTestRenderer[] = [];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const rendererWarning = 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer';
let warning: Mock<typeof console.error>;
beforeEach(() => { warning = spyOn(console, 'error').mockImplementation(() => {}); });

function deferred(): { promise: Promise<string>; resolve(value: string): void; reject(error: Error): void } {
  let resolve!: (value: string) => void, reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Probe({ load, renders }: { load: Loader; renders: Snapshot[] }): React.ReactNode {
  const resource = useResource(load);
  renders.push({ data: resource.data, error: resource.error, loading: resource.loading });
  return createElement('output', null, resource.data ?? resource.error ?? (resource.loading ? 'loading' : 'idle'));
}
async function mount(load: Loader, renders: Snapshot[]): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(createElement(Probe, { load, renders })); });
  mounted.push(renderer);
  return renderer;
}
async function setActive(value: boolean): Promise<void> {
  await act(async () => { active = value; for (const listener of listeners) listener(); });
}
afterEach(async () => {
  await act(async () => { for (const renderer of mounted.splice(0)) renderer.unmount(); });
  active = true;
  const messages = warning.mock.calls.map(call => call[0]);
  warning.mockRestore();
  expect(messages.length).toBeGreaterThan(0);
  expect(messages.every(message => message === rendererWarning)).toBe(true);
});

test('changing a private loader never renders the previous account data', async () => {
  const first = deferred(), second = deferred(), renders: Snapshot[] = [];
  const renderer = await mount(() => first.promise, renders);
  await act(async () => first.resolve('private account A'));
  expect(renders.at(-1)?.data).toBe('private account A');
  renders.length = 0;
  await act(async () => renderer.update(createElement(Probe, { load: () => second.promise, renders })));
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every(value => value.data === null && value.error === null && value.loading)).toBe(true);
  await act(async () => second.resolve('private account B'));
  expect(renders.at(-1)?.data).toBe('private account B');
});

test('changing a private loader hides the previous account error on its first render', async () => {
  const first = deferred(), second = deferred(), renders: Snapshot[] = [];
  const renderer = await mount(() => first.promise, renders);
  await act(async () => first.reject(new Error('account A private error')));
  expect(renders.at(-1)?.error).toBe('account A private error');
  renders.length = 0;
  await act(async () => renderer.update(createElement(Probe, { load: () => second.promise, renders })));
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every(value => value.data === null && value.error === null)).toBe(true);
});

test('refocusing retains the same resource while refreshing and ignores an aborted response', async () => {
  const requests: { signal: AbortSignal; result: ReturnType<typeof deferred> }[] = [], renders: Snapshot[] = [];
  const load: Loader = signal => { const result = deferred(); requests.push({ signal, result }); return result.promise; };
  await mount(load, renders);
  await act(async () => requests[0]!.result.resolve('cached same account'));
  await setActive(false);
  expect(requests[0]!.signal.aborted).toBe(true);
  expect(renders.at(-1)).toEqual({ data: 'cached same account', error: null, loading: false });
  await setActive(true);
  expect(requests).toHaveLength(2);
  expect(renders.at(-1)).toEqual({ data: 'cached same account', error: null, loading: true });
  await setActive(false);
  expect(requests[1]!.signal.aborted).toBe(true);
  await act(async () => requests[1]!.result.resolve('late hidden response'));
  expect(renders.at(-1)?.data).toBe('cached same account');
  await setActive(true);
  await act(async () => requests[2]!.result.resolve('current response'));
  expect(renders.at(-1)).toEqual({ data: 'current response', error: null, loading: false });
});

test('an initially inactive screen starts no request and aborts its request when it becomes inactive', async () => {
  active = false;
  const result = deferred(), signals: AbortSignal[] = [], renders: Snapshot[] = [];
  await mount(signal => { signals.push(signal); return result.promise; }, renders);
  expect(signals).toHaveLength(0);
  expect(renders.at(-1)?.loading).toBe(false);
  await setActive(true);
  expect(signals).toHaveLength(1);
  await setActive(false);
  expect(signals[0]!.aborted).toBe(true);
  await act(async () => result.resolve('stale result'));
  expect(renders.at(-1)).toEqual({ data: null, error: null, loading: false });
});

test('changing a paginated private loader hides its previous error before effects run', async () => {
  type Item = { id: number; name: string };
  type PagedLoad = (page: number, signal: AbortSignal) => Promise<Page<Item>>;
  const renders: { data: Page<Item> | null; error: string | null; loading: boolean }[] = [];
  function PagedProbe({ load }: { load: PagedLoad }): React.ReactNode {
    const resource = usePages(load);
    renders.push({ data: resource.data, error: resource.error, loading: resource.loading });
    return createElement('output', null, resource.error);
  }
  const first: PagedLoad = async () => { throw new Error('account A private page error'); };
  const second: PagedLoad = () => new Promise(() => {});
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(createElement(PagedProbe, { load: first })); });
  mounted.push(renderer);
  expect(renders.at(-1)?.error).toBe('account A private page error');
  renders.length = 0;
  await act(async () => renderer.update(createElement(PagedProbe, { load: second })));
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every(snapshot => snapshot.data === null && snapshot.error === null && snapshot.loading)).toBe(true);
});

for (const status of [401, 403]) {
  test(`a resource drops cached private data after an authoritative ${status} response`, async () => {
    const requests: ReturnType<typeof deferred>[] = [], renders: Snapshot[] = [];
    await mount(() => { const result = deferred(); requests.push(result); return result.promise; }, renders);
    await act(async () => requests[0]!.resolve('private cached data'));
    await setActive(false);
    await setActive(true);
    await act(async () => requests[1]!.reject(new ApiError('http', 'access denied', status)));
    expect(renders.at(-1)).toEqual({ data: null, error: 'access denied', loading: false });
  });

  test(`pagination drops cached private rows after an authoritative ${status} response`, async () => {
    type Item = { id: number; name: string };
    const renders: { data: Page<Item> | null; error: string | null; loading: boolean }[] = [];
    let denied = false;
    const load = async (): Promise<Page<Item>> => {
      if (denied) throw new ApiError('http', 'access denied', status);
      return { items: [{ id: 1, name: 'private row' }], currentPage: 1, lastPage: 1, total: 1 };
    };
    function PagedProbe(): React.ReactNode {
      const resource = usePages(load);
      renders.push({ data: resource.data, error: resource.error, loading: resource.loading });
      return createElement('output', null, resource.data?.items[0]?.name ?? resource.error);
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(PagedProbe)); });
    mounted.push(renderer);
    expect(renders.at(-1)?.data?.items[0]?.name).toBe('private row');
    denied = true;
    await setActive(false);
    await setActive(true);
    expect(renders.at(-1)).toEqual({ data: null, error: 'access denied', loading: false });
  });
}

test('a temporary network failure retains cached data for the same resource', async () => {
  const requests: ReturnType<typeof deferred>[] = [], renders: Snapshot[] = [];
  await mount(() => { const result = deferred(); requests.push(result); return result.promise; }, renders);
  await act(async () => requests[0]!.resolve('cached data'));
  await setActive(false);
  await setActive(true);
  await act(async () => requests[1]!.reject(new ApiError('network', 'connection unavailable')));
  expect(renders.at(-1)).toEqual({ data: 'cached data', error: 'connection unavailable', loading: false });
});

test('denied pagination invalidates retained pages and retries after access returns', async () => {
  type Item = { id: number; name: string };
  const requests: number[] = [], renders: { data: Page<Item> | null; error: string | null }[] = [];
  let more!: () => void;
  const load = async (page: number): Promise<Page<Item>> => {
    requests.push(page);
    if (page === 2) throw new ApiError('http', 'access denied', 403);
    return { items: [{ id: requests.length, name: 'private row' }], currentPage: page, lastPage: 2, total: 2 };
  };
  function PagedProbe(): React.ReactNode {
    const resource = usePages(load, true, true);
    more = resource.more;
    renders.push({ data: resource.data, error: resource.error });
    return createElement('output', null, resource.data?.items[0]?.name ?? resource.error);
  }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(createElement(PagedProbe)); });
  mounted.push(renderer);
  await act(async () => more());
  expect(renders.at(-1)).toEqual({ data: null, error: 'access denied' });
  await setActive(false);
  await setActive(true);
  expect(requests).toEqual([1, 2, 1]);
  expect(renders.at(-1)?.data?.items[0]?.id).toBe(3);
  expect(renders.at(-1)?.error).toBeNull();
});
