export interface Organization {
  city?: string;
  country?: string;
  description?: string;
  email?: string;
  formattedLocation?: string;
  id: string;
  lang?: string;
  manifesto?: string;
  mvpMembers?: string;
  name: string;
  phone?: string;
  politicalLeanings?: string[];
  socialFb?: string;
  socialInsta?: string;
  socialX?: string;
  telegram?: string;
  type?: string;
  website?: string;
  youtube?: string;
}

export const COLUMNS = {
  CATEGORY: 'type',
  CITY: 'city',
  COUNTRY: 'country of origin',
  DESCRIPTION: 'short description',
  EMAIL: 'Email',
  FACEBOOK_ACCOUNT: 'social - fb',
  INITIATIVE_NAME: 'name',
  INSTAGRAM_ACCOUNT: 'social - insta',
  LANG: 'lang',
  MANIFESTO_LINK: 'manifesto link',
  MVP_MEMBERS: 'MVP members',
  PHONE: 'Phone',
  TELEGRAM: 'social - telegram',
  WEBSITE: 'website',
  X_ACCOUNT: 'social - x',
  YOUTUBE: 'social - youtube',
} as const;

/*
PORT STATUS
  source:     resources/js/Pages/Party/types.ts (43 lines)
  confidence: high
  todos:      0
  notes:      The native API module replaces direct CSV access.
*/
