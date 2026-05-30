import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'أفضل المساهمين السوريين في GitHub',
    description: 'تكريم المطورين السوريين المساهمين في المصادر المفتوحة والبرمجيات الحرة.',
    openGraph: {
        title: 'أفضل المساهمين السوريين في GitHub - المساحة السورية',
        description: 'تكريم المطورين السوريين المساهمين في المصادر المفتوحة والبرمجيات الحرة.',
        images: ['/assets/thumbnail.jpg'],
    },
};

export default function ContributorsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
