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

export const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW4BMKTSgWlF6ppCgGxzVxvFIdADOG7G5MxIuiRuOCysCIdC_BYpLURlyQwOsrsJj_5q_vn7JwheCF/pub?gid=0&single=true&output=csv';
