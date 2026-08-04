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
