import raw from '../../../data/social-platforms.json';

/**
 * The social-link vocabulary of an official entity: the keys a
 * `OfficialEntity.socials` object can carry, in display order, with their
 * labels. From `resources/data/social-platforms.json`.
 */
export interface SocialPlatform {
  key: string;
  labelAr: string;
  labelEn: string;
}

/** The ordered vocabulary; an editor's form state should be built from it. */
export const SOCIAL_PLATFORMS: SocialPlatform[] = raw.map((platform) => ({
  key: platform.key,
  labelAr: platform.label_ar,
  labelEn: platform.label_en,
}));

/** The platform's name in the reader's language, or the raw key when unknown. */
export function socialPlatformLabel(key: string, language: 'ar' | 'en'): string {
  const platform = SOCIAL_PLATFORMS.find((entry) => entry.key === key);

  return platform === undefined ? key : language === 'ar' ? platform.labelAr : platform.labelEn;
}
