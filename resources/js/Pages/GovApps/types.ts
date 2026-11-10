export interface GovApp {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    images: string[];
    links: {
        official?: string | null;
        android?: string | null;
        apple?: string | null;
    };
}
