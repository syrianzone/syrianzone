export async function restoreSession<T>({ readToken, setToken, loadUser, isCurrent }: {
  readToken(): Promise<string | null>; setToken(token: string): void; loadUser(): Promise<T>; isCurrent(): boolean;
}): Promise<T | null> {
  const token = await readToken();
  if (!isCurrent() || !token) return null;
  setToken(token);
  try {
    const user = await loadUser();
    return isCurrent() ? user : null;
  } catch (error) { if (isCurrent()) throw error; return null; }
}
