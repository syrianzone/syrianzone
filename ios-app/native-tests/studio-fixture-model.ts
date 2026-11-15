import type { KeyValueStore } from '../src/storage';
import { fixtureOrigin } from './account-fixture-model';

// This fixture reads the existing document bytes before importing the product.
// Existing pending-login drawings are never decoded, logged, consumed or replaced.
export async function requireAbsentStudioPending(storage: Pick<KeyValueStore, 'getItemAsync'>): Promise<{ pending: 'absent' }> {
  const raw = await storage.getItemAsync('syrian-zone.document.transit-studio.pending.v1');
  if (raw !== null && !/^[\x20\t\r\n]*null[\x20\t\r\n]*$/.test(raw)) throw new Error('The local Studio fixture refuses an existing pending document.');
  return { pending: 'absent' };
}

export type StudioFixtureTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export async function prepareStudioPending(storage: Pick<KeyValueStore, 'getItemAsync'>, issuedToken: string, transport: StudioFixtureTransport): Promise<{ pending: 'absent' }> {
  if (!/^\d+\|[A-Za-z0-9_-]{16,256}$/.test(issuedToken)) throw new Error('Local Studio issued session rejected.');
  try { return await requireAbsentStudioPending(storage); }
  catch (reason) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
    try {
      // Only the freshly issued, verified member session is revoked. It has not
      // been installed in Keychain or adopted by the product at this point.
      const url = `${fixtureOrigin}/api/v1/auth/logout`;
      const response = await transport(url, { method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${issuedToken}` } });
      const result: unknown = await response.json();
      if (response.status !== 200 || response.redirected || response.url !== url || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true)
        throw new Error('Local Studio issued session cleanup failed.');
    } catch { throw new Error('Local Studio issued session cleanup failed.'); }
    finally { clearTimeout(timer); }
    throw reason;
  }
}
