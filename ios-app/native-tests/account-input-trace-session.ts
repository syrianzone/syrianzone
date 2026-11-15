import { installInputTrace, type InputTraceController } from './account-input-trace';

// A refused observer must not leave its freshly verified, uninstalled session token behind.
export async function prepareInputTrace(namespace: unknown, scope: Parameters<typeof installInputTrace>[1], token: string,
  transport: typeof fetch): Promise<InputTraceController> {
  if (!/^\d+\|[A-Za-z0-9_-]{16,256}$/.test(token)) throw new Error('Input trace fresh session rejected.');
  try {
    if (!namespace || typeof namespace !== 'object') throw new Error('Input trace namespace rejected.');
    return installInputTrace(namespace, scope);
  }
  catch (reason) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const url = 'https://127.0.0.1:9443/api/v1/auth/logout';
      const response = await transport(url, { method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      const result: unknown = await response.json();
      if (response.status !== 200 || response.redirected || response.url !== url || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true)
        throw new Error('Input trace fresh session cleanup failed.');
    } catch { throw new Error('Input trace fresh session cleanup failed.'); }
    finally { clearTimeout(timeout); }
    throw reason;
  }
}
