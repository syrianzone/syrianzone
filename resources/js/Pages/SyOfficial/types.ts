export interface SocialLinks {
    [key: string]: string;
}

export interface OfficialEntity {
    id: string;
    name: string;
    name_ar: string;
    description: string;
    description_ar: string;
    image: string;
    category: string;
    socials: SocialLinks;
}

export const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAtwovmqnk0722ikCNL1RAeoEWyJ2tec3L0-sGHe-0kbmKs0ZPOIyCxOP4e74ndkPooauvG9ZeLTWT/pub?gid=0&single=true&output=csv';
