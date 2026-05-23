import { Metadata } from 'next';
import CompassClient from './CompassClient';

export const metadata: Metadata = {
    title: 'دليل المنظمات السياسية السورية',
    description: 'دليل المنظمات السياسية السورية - اكتشف وتصفح المنظمات السياسية السورية.',
    openGraph: {
        title: 'دليل المنظمات السياسية السورية - المساحة السورية',
        description: 'دليل المنظمات السياسية السورية - اكتشف وتصفح المنظمات السياسية السورية.',
        images: ['/assets/thumbnail.jpg'],
    },
};


export default function AlignmentPage() {
    return <CompassClient />;
}
