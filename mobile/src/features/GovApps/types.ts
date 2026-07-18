export interface GovApp {
  description: string;
  icon: string;
  id: string;
  images: string[];
  links: {
    android?: null | string;
    apple?: null | string;
    official?: null | string;
  };
  name: string;
}

/*
PORT STATUS
  source:     resources/js/Pages/GovApps/types.ts (14 lines)
  confidence: high
  todos:      0
  notes:      The native API module replaces direct CSV and filesystem access.
*/
