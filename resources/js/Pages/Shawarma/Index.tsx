import React from 'react';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/card';
import MainLayout from '@/Layouts/MainLayout';

function InstagramIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
            <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.17.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.17a3.6 3.6 0 00-.88-1.35 3.6 3.6 0 00-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.24-.06-1.59-.07-4.74-.07zM12 6.92a5.08 5.08 0 100 10.16A5.08 5.08 0 0012 6.92zm0 8.38a3.3 3.3 0 110-6.6 3.3 3.3 0 010 6.6zm5.27-9.6a1.19 1.19 0 100 2.38 1.19 1.19 0 000-2.38z" />
        </svg>
    );
}

function FacebookIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06z" />
        </svg>
    );
}

type Spot = {
    name: string;
    logo: string;
    href: string;
    social: 'instagram' | 'facebook';
};

type Tier = {
    rank: 'S' | 'A' | 'B' | 'C';
    badge: string;
    spots: Spot[];
};

const tiers: Tier[] = [
    {
        rank: 'S',
        badge: 'bg-red-500',
        spots: [
            { name: 'Just Shawarma', logo: '/shawarma/just-shawarma.png', href: 'https://www.instagram.com/justshawarma.sy/', social: 'instagram' },
            { name: 'Alger', logo: '/shawarma/alager.png', href: 'https://www.instagram.com/shawrma.alaghr/', social: 'instagram' },
            { name: 'Check In', logo: '/shawarma/checkin.jpg', href: 'https://www.instagram.com/checkin.sy/', social: 'instagram' },
        ],
    },
    {
        rank: 'A',
        badge: 'bg-orange-500',
        spots: [
            { name: 'Sbenti', logo: '/shawarma/sbenti.png', href: 'https://www.facebook.com/p/Spenti-snak-100063744110605/', social: 'facebook' },
            { name: 'Kamal Ayash', logo: '/shawarma/Kamal-Ayash.jpg', href: 'https://www.instagram.com/kamalayash1/', social: 'instagram' },
        ],
    },
    {
        rank: 'B',
        badge: 'bg-yellow-400',
        spots: [
            { name: 'Shawerha', logo: '/shawarma/SHAWERHA.png', href: 'https://www.instagram.com/shawerhaofficial/', social: 'instagram' },
            { name: 'Faruk', logo: '/shawarma/faruk.jpg', href: 'https://www.instagram.com/alfarouk.res/', social: 'instagram' },
            { name: 'Abu Rateb', logo: '/shawarma/abu-rateb.png', href: 'https://www.instagram.com/aburatebchicken', social: 'instagram' },
        ],
    },
    {
        rank: 'C',
        badge: 'bg-green-500',
        spots: [
            { name: 'Alaga', logo: '/shawarma/alaga.png', href: 'https://www.facebook.com/alagha.Broast.shawarma/', social: 'facebook' },
        ],
    },
];

export default function ShawarmaPage() {
    return (
        <MainLayout>
            <Head title="@macdoos's Shawarma Tier List" />
            <main className="container mx-auto px-4 pt-6 pb-12" dir="ltr">
                <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-8 text-foreground">
                    @macdoos&apos;s Shawarma Tier List
                </h1>

                <Card className="max-w-screen-lg mx-auto overflow-hidden">
                    <CardContent className="p-0 divide-y divide-border">
                        {tiers.map((tier) => (
                            <div key={tier.rank} className="flex items-stretch">
                                {/* Tier badge */}
                                <div
                                    className={`${tier.badge} shrink-0 w-20 sm:w-28 flex items-center justify-center text-black`}
                                >
                                    <span className="text-4xl sm:text-5xl font-extrabold leading-none">
                                        {tier.rank}
                                    </span>
                                </div>

                                {/* Spots */}
                                <div className="flex-1 flex flex-wrap items-center gap-4 p-4 bg-card">
                                    {tier.spots.map((spot) => {
                                        const SocialIcon =
                                            spot.social === 'instagram' ? InstagramIcon : FacebookIcon;
                                        return (
                                            <a
                                                key={spot.name}
                                                href={spot.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative flex flex-col items-center gap-2 transition-transform duration-300 hover:-translate-y-1"
                                                title={spot.name}
                                            >
                                                <img
                                                    src={spot.logo}
                                                    alt={spot.name}
                                                    loading="lazy"
                                                    className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-2xl border border-border bg-muted"
                                                />
                                                <span className="text-sm font-semibold text-foreground">
                                                    {spot.name}
                                                </span>
                                                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-primary opacity-0 transition-all duration-300 group-hover:opacity-100">
                                                    <SocialIcon className="h-4 w-4" />
                                                </span>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </main>
        </MainLayout>
    );
}
