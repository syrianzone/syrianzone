export async function prepareExportFile<T>(
  port: {
    write(): Promise<void>;
    encode(): Promise<T>;
    removeSource(): void;
    removeOutput(value: T): void;
  },
  cancelled: () => boolean,
): Promise<T> {
  let output: { value: T } | undefined;
  try {
    try {
      await port.write();
      if (cancelled()) throw new Error('تم إلغاء تجهيز الصورة.');
      output = { value: await port.encode() };
      if (cancelled()) throw new Error('تم إلغاء تجهيز الصورة.');
      return output.value;
    } finally {
      port.removeSource();
    }
  } catch (error) {
    if (output) {
      try {
        port.removeOutput(output.value);
      } catch {
        // Preserve the failure that prevented the caller from receiving the file.
      }
    }
    throw error;
  }
}
