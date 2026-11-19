type Settings = Record<string, unknown>;
export function createSettingsQueue({ identity, write, apply }: {
  identity(): string | null; write(patch: Settings): Promise<Settings>; apply(settings: Settings): void;
}): (patch: Settings, expectedIdentity?: string | null) => Promise<Settings> {
  let tail: Promise<void> = Promise.resolve();
  return (patch, expectedIdentity) => {
    const account = expectedIdentity === undefined ? identity() : expectedIdentity;
    const pending = tail.then(async () => {
      if (account === null || identity() !== account) throw new Error('تغيّر الحساب. لم يتم إرسال الإعدادات.');
      const settings = await write(patch);
      if (identity() !== account) throw new Error('تغيّر الحساب أثناء الحفظ.');
      apply(settings);
      return settings;
    });
    tail = pending.then(() => undefined, () => undefined);
    return pending;
  };
}
