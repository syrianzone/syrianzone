export async function endSession({ revoke, alreadyRevoked, clearLocal }: {
  revoke(): Promise<unknown>; alreadyRevoked(error: unknown): boolean; clearLocal(): Promise<void>;
}): Promise<void> {
  try { await revoke(); } catch (error) { if (!alreadyRevoked(error)) throw error; }
  await clearLocal();
}
