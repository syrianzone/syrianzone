export interface Organization {
    id: string;
    name: string;
    description?: string;
    type?: string;
    country?: string;
    city?: string;
    formattedLocation?: string; // Derived field
    socialX?: string;
    socialInsta?: string;
    socialFb?: string;
    website?: string;
    manifesto?: string;
    email?: string;
    phone?: string;
    lang?: string;
    politicalLeanings?: string[]; // Parsed from string
    mvpMembers?: string;
    youtube?: string;
    telegram?: string;
}

export const COLUMNS = {
    INITIATIVE_NAME: 'name',
    X_ACCOUNT: 'social - x',
    INSTAGRAM_ACCOUNT: 'social - insta',
    FACEBOOK_ACCOUNT: 'social - fb',
    WEBSITE: 'website',
    COUNTRY: 'country of origin',
    CITY: 'city',
    PHONE: 'Phone',
    EMAIL: 'Email',
    CATEGORY: 'type',
    DESCRIPTION: 'short description',
    POLITICAL_LEANINGS: 'political leanings',
    MVP_MEMBERS: 'MVP members',
    MANIFESTO_LINK: 'manifesto link',
    LANG: 'lang',
    YOUTUBE: 'social - youtube', // Inferred from script.js usage though not in config.js explicit mapping
    TELEGRAM: 'social - telegram' // Inferred
};

export const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxa48kbdV2X5Umd3WGDeU7xX5qFVRpyA3uDFhI9w2FAOuxSiGebSpKrVpjU-13XswnNgxHvfWw-sbJ/pub?output=csv';
