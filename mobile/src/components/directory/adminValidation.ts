const DIRECTORY_ID = /^[A-Za-z0-9_-]+$/;

export function cleanRequiredText(value: string, label: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    throw new Error(`أدخل ${label}.`);
  }
  return cleaned;
}

export function cleanOptionalText(value: string): string | null {
  const cleaned = value.trim();
  return cleaned || null;
}

export function safeDirectoryId(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || !DIRECTORY_ID.test(cleaned)) {
    throw new Error('استخدم أحرفاً وأرقاماً وشرطات فقط.');
  }
  return cleaned;
}

export function safeOptionalHttpUrl(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new Error('أدخل رابطاً يبدأ بـ http أو https.');
  }
}
