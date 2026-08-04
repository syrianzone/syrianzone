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
