export interface GovApp {
    id: string;
    name: string;
    description: string;
    icon: string;
    images: string[];
    links: {
        official?: string;
        android?: string;
        apple?: string;
    };
}
