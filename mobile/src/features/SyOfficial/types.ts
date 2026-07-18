export interface SocialLinks {
  [key: string]: string;
}

export interface OfficialEntity {
  category: string;
  description: string;
  description_ar: string;
  id: string;
  image: string;
  name: string;
  name_ar: string;
  socials: SocialLinks;
}

/*
PORT STATUS
  source:     resources/js/Pages/SyOfficial/types.ts (16 lines)
  confidence: high
  todos:      0
  notes:      The native API module replaces direct CSV access.
*/
