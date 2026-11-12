import React from 'react';

import { Card, CardContent } from '@/Components/ui/card';
import { Facebook, Instagram } from '@/Components/ui/icons';
import MainLayout from '@/Layouts/MainLayout';

type Spot = {
    name: string;
    logo: string;
    href: string;
    social: 'instagram' | 'facebook';
};

type Tier = {
    rank: 'S' | 'A' | 'B' | 'C';
    color: string;
    spots: Spot[];
};

const tiers: Tier[] = [
    {
        rank: 'S',
        color: 'text-red-500',
        spots: [
            { name: 'Just Shawarma', logo: '/assets/shawarma/just-shawarma.webp', href: 'https://www.instagram.com/justshawarma.sy/', social: 'instagram' },
            { name: 'Alger', logo: '/assets/shawarma/alager.webp', href: 'https://www.instagram.com/shawrma.alaghr/', social: 'instagram' },
            { name: 'Check In', logo: '/assets/shawarma/checkin.webp', href: 'https://www.instagram.com/checkin.sy/', social: 'instagram' },
            { name: 'Sbenti', logo: '/assets/shawarma/sbenti.webp', href: 'https://www.facebook.com/p/Spenti-snak-100063744110605/', social: 'facebook' },
        ],
    },
    {
        rank: 'A',
        color: 'text-orange-500',
        spots: [
            { name: 'Kamal Ayash', logo: '/assets/shawarma/Kamal-Ayash.webp', href: 'https://www.instagram.com/kamalayash1/', social: 'instagram' },
            { name: 'Paprika', logo: '/assets/shawarma/paprika.webp', href: 'https://www.instagram.com/paprika.syria', social: 'instagram' },
        ],
    },
    {
        rank: 'B',
        color: 'text-yellow-400',
        spots: [
            { name: 'Shawerha', logo: '/assets/shawarma/SHAWERHA.webp', href: 'https://www.instagram.com/shawerhaofficial/', social: 'instagram' },
            { name: 'Faruk', logo: '/assets/shawarma/faruk.webp', href: 'https://www.instagram.com/alfarouk.res/', social: 'instagram' },
            { name: 'Abu Rateb', logo: '/assets/shawarma/abu-rateb.webp', href: 'https://www.instagram.com/aburatebchicken', social: 'instagram' },
        ],
    },
    {
        rank: 'C',
        color: 'text-green-500',
        spots: [
            { name: 'Alaga', logo: '/assets/shawarma/alaga.webp', href: 'https://www.facebook.com/alagha.Broast.shawarma/', social: 'facebook' },
        ],
    },
];

export default function ShawarmaPage() {
    return (
        <MainLayout>
            
            <div className="container mx-auto px-4 pt-6 pb-12" dir="ltr">
                <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-8 text-foreground">
                    @macdoos&apos;s Shawarma Tier List
                </h1>

                <Card className="max-w-screen-lg mx-auto overflow-hidden">
                    <CardContent className="p-0 divide-y divide-border">
                        {tiers.map((tier) => (
                            <div key={tier.rank} className="flex items-stretch">
                                {/* Tier badge */}
                                <div className="shrink-0 w-20 sm:w-28 flex items-center justify-center bg-muted">
                                    <span className={`${tier.color} text-4xl sm:text-5xl font-extrabold leading-none`}>
                                        {tier.rank}
                                    </span>
                                </div>

                                {/* Spots */}
                                <div className="flex-1 flex flex-wrap items-center gap-4 p-4 bg-card">
                                    {tier.spots.map((spot) => {
                                        const SocialIcon =
                                            spot.social === 'instagram' ? Instagram : Facebook;
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
                                                    alt=""
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
            </div>
        </MainLayout>
    );
}
