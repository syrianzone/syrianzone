import type { AlignmentFixtureLaunch } from './alignment-launch-model';
export type AlignmentTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// Same exact fresh, uninstalled-session logout contract used by Studio/Prayer.
async function revoke(token: string, transport: AlignmentTransport): Promise<void> {
  const url = 'https://127.0.0.1:9443/api/v1/auth/logout';
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await transport(url, { method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
    const value: unknown = await response.json();
    if (response.status !== 200 || response.redirected || response.url !== url || !value || typeof value !== 'object' || !('ok' in value) || value.ok !== true) throw new Error();
  } catch { throw new Error('The fresh local Alignment session could not be revoked.'); }
  finally { clearTimeout(timeout); }
}

export async function prepareAlignmentSession<T>(launch: AlignmentFixtureLaunch, verifiedID: unknown, token: string, transport: AlignmentTransport,
  task: () => Promise<T>): Promise<T> {
  if (!/^\d+\|[A-Za-z0-9_-]{16,256}$/.test(token)) throw new Error('Local Alignment issued session rejected.');
  let value: T;
  try {
    if (verifiedID !== 101 || launch.user !== 'member' || launch.variant !== 'alignment') throw new Error('The exact local member101 identity is required.');
    value = await task();
  } catch (reason) { await revoke(token, transport); throw reason; }
  // Close never installs this token in Keychain and never imports App.
  if (launch.stage === 'close') await revoke(token, transport);
  return value;
}
