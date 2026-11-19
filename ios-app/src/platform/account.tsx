import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api';
import { decodeAccountUser, type AccountUser } from './account-model';
import { record } from './validation';
import { createSettingsQueue } from './settings-queue';
import { restoreSession } from './restore-session';
import { endSession } from './end-session';
import { readAccessToken, replaceAccessToken } from './credentials';
import type { MobileSession } from './mobile-session-model';
import { requestSuperadminSession } from './mobile-login';
import { signInNativeGoogle } from './native-google';

export type { AccountUser } from './account-model';
export interface AccountState {
  user: AccountUser | null; ready: boolean; error: string | null; sessionGeneration: number; busy: boolean;
  signIn(): Promise<void>; signOut(): Promise<void>; refresh(): Promise<void>;
  signInSuperadmin(email: string, password: string): Promise<void>;
  clearDeletedSession(expectedGeneration: number): Promise<void>;
  saveSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>>;
}
const Context = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionGeneration, setSessionGeneration] = useState(api.getSessionGeneration);
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const alive = useRef(true);
  const currentUser = useRef<AccountUser | null>(null);
  const epoch = useRef(0);
  const pendingSignIn = useRef<AbortController | null>(null);
  const applyUser = useCallback((value: AccountUser | null) => { currentUser.current = value; setUser(value); }, []);
  const [enqueueSettings] = useState(() => createSettingsQueue({
    identity: () => currentUser.current ? `${epoch.current}:${currentUser.current.id}` : null,
    write: patch => api.request('user/settings', value => {
      const row = record(value);
      if (row.status !== 'ok') throw new Error('لم يتم تأكيد حفظ الإعدادات.');
      return record(row.settings);
    }, { method: 'PATCH', authenticated: true, body: { settings: patch } }),
    apply: settings => { if (currentUser.current) applyUser({ ...currentUser.current, settings }); }
  }));
  const renderIdentity = currentUser.current ? `${epoch.current}:${currentUser.current.id}` : null;
  const saveSettings = (patch: Record<string, unknown>) => mutation.current ? Promise.reject(new Error('جارٍ تحديث الحساب. حاول مجدداً.')) : enqueueSettings(patch, renderIdentity);
  const refresh = useCallback(async () => {
    const generation = epoch.current;
    const value = await api.request('user', decodeAccountUser, { authenticated: true });
    if (alive.current && generation === epoch.current) { applyUser(value); setError(null); }
  }, [applyUser]);
  useEffect(() => {
    alive.current = true;
    let active = true;
    const generation = epoch.current;
    const isCurrent = () => active && alive.current && generation === epoch.current;
    const controller = new AbortController();
    void (async () => {
      try {
        const value = await restoreSession({ readToken: readAccessToken, setToken: token => { api.setAccessToken(token); setSessionGeneration(api.getSessionGeneration()); },
          loadUser: () => api.request('user', decodeAccountUser, { authenticated: true, signal: controller.signal }), isCurrent });
        if (value && isCurrent()) applyUser(value);
      } catch (reason) {
        if (!isCurrent()) return;
        if (reason instanceof ApiError && reason.status === 401) {
          try { await replaceAccessToken(null, isCurrent, () => { api.setAccessToken(null); setSessionGeneration(api.getSessionGeneration()); applyUser(null); }); }
          catch (failure) { if (isCurrent()) setError(failure instanceof Error ? failure.message : 'تعذر حذف تسجيل الدخول المنتهي.'); }
        }
        else if (alive.current) setError(reason instanceof Error ? reason.message : 'تعذر قراءة الحساب.');
      } finally { if (isCurrent()) setReady(true); }
    })();
    return () => { active = false; alive.current = false; controller.abort(); pendingSignIn.current?.abort(); };
  }, [applyUser]);

  async function adoptSession(session: MobileSession, isCurrent: () => boolean): Promise<void> {
    await replaceAccessToken(session.token, isCurrent, () => {
      epoch.current += 1;
      api.setAccessToken(session.token);
      setSessionGeneration(api.getSessionGeneration());
      applyUser(session.user);
    });
  }
  async function signIn(): Promise<void> {
    if (!ready) throw new Error('جارٍ استعادة الحساب. انتظر قليلاً ثم حاول مجدداً.');
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    const generation = epoch.current, requestGeneration = api.getSessionGeneration();
    const isCurrent = () => alive.current && !controller.signal.aborted && epoch.current === generation && api.getSessionGeneration() === requestGeneration;
    pendingSignIn.current = controller;
    try {
      const session = await signInNativeGoogle(controller.signal, isCurrent);
      if (session && isCurrent()) await adoptSession(session, isCurrent);
    } catch (reason) {
      if (!isCurrent()) return;
      setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول.');
      throw reason;
    } finally {
      if (pendingSignIn.current === controller) pendingSignIn.current = null;
      mutation.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function signInSuperadmin(email: string, password: string): Promise<void> {
    if (!ready) throw new Error('جارٍ استعادة الحساب. انتظر قليلاً ثم حاول مجدداً.');
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    const generation = epoch.current, requestGeneration = api.getSessionGeneration();
    const isCurrent = () => alive.current && !controller.signal.aborted && epoch.current === generation && api.getSessionGeneration() === requestGeneration;
    pendingSignIn.current = controller;
    try { await adoptSession(await requestSuperadminSession(api, email, password, controller.signal), isCurrent); }
    catch (reason) { if (!isCurrent()) return; setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول.'); throw reason; }
    finally { if (pendingSignIn.current === controller) pendingSignIn.current = null; mutation.current = false; if (alive.current) setBusy(false); }
  }
  async function signOut(): Promise<void> {
    if (mutation.current) return;
    if (renderIdentity === null || renderIdentity !== (currentUser.current ? `${epoch.current}:${currentUser.current.id}` : null)) throw new Error('تغيّر الحساب. أعد المحاولة.');
    mutation.current = true;
    setBusy(true);
    epoch.current += 1;
    api.invalidateSessionRequests(); setSessionGeneration(api.getSessionGeneration());
    const generation = epoch.current, requestGeneration = api.getSessionGeneration();
    const isCurrent = () => alive.current && epoch.current === generation && api.getSessionGeneration() === requestGeneration;
    try {
      await endSession({ revoke: () => api.request('auth/logout', () => undefined, { method: 'POST', authenticated: true }),
        alreadyRevoked: reason => reason instanceof ApiError && reason.status === 401,
        clearLocal: async () => { await replaceAccessToken(null, isCurrent, () => { api.setAccessToken(null); setSessionGeneration(api.getSessionGeneration()); applyUser(null); setError(null); }); } });
    } catch (reason) { if (!isCurrent()) return; setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الخروج.'); throw reason; }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  async function clearDeletedSession(expectedGeneration: number): Promise<void> {
    if (expectedGeneration !== api.getSessionGeneration() || mutation.current) throw new Error('تغيّرت الجلسة. أعد المحاولة.');
    mutation.current = true; setBusy(true); epoch.current += 1;
    api.invalidateSessionRequests(); setSessionGeneration(api.getSessionGeneration());
    const generation = epoch.current, requestGeneration = api.getSessionGeneration();
    const isCurrent = () => alive.current && epoch.current === generation && api.getSessionGeneration() === requestGeneration;
    try { await replaceAccessToken(null, isCurrent, () => { api.setAccessToken(null); setSessionGeneration(api.getSessionGeneration()); applyUser(null); setError(null); }); }
    catch {
      if (!isCurrent()) return;
      api.setAccessToken(null); setSessionGeneration(api.getSessionGeneration()); applyUser(null);
      const failure = new Error('تم حذف الحساب. تعذر إزالة تسجيل الدخول المحفوظ من الجهاز. افتح الجهاز ثم أعد تشغيل التطبيق.'); setError(failure.message); throw failure;
    }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  return <Context.Provider value={{ user, ready, error, sessionGeneration, busy, signIn, signInSuperadmin, signOut, refresh, saveSettings, clearDeletedSession }}>{children}</Context.Provider>;
}
export function useAccount(): AccountState {
  const value = useContext(Context);
  if (!value) throw new Error('AccountProvider is missing');
  return value;
}
export function useCan(permission: string): boolean { return useAccount().user?.effective_permissions.includes(permission) ?? false; }
