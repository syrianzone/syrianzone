export async function prepareExportFile<T>(
  port: {
    write(): Promise<void>;
    encode(): Promise<T>;
    removeSource(): void;
    removeOutput(value: T): void;
  },
  cancelled: () => boolean,
): Promise<T> {
  try {
    await port.write();
    if (cancelled()) throw new Error('تم إلغاء تجهيز الصورة.');
    const output = await port.encode();
    if (cancelled()) {
      port.removeOutput(output);
      throw new Error('تم إلغاء تجهيز الصورة.');
    }
    return output;
  } finally {
    port.removeSource();
  }
}
