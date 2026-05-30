import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import HouseClient from './HouseClient';

export default function HousePage() {
    return (
        <MainLayout>
            <div className="min-h-screen bg-background pb-16">
                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    <HouseClient
                        initialData={[]}
                        initialHeaders={[]}
                        initialMode="voters"
                    />
                </div>

                <footer className="py-8 bg-card text-center text-sm text-muted-foreground border-t border-border mt-12">
                    <p>&copy; 2025 syrian.zone</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <a href="https://hadealahmad.com" target="_blank" className="hover:text-primary transition">الموقع الشخصي</a>
                        <a href="https://x.com/hadealahmad" target="_blank" className="hover:text-primary transition">Twitter</a>
                    </div>
                </footer>
            </div>
        </MainLayout>
    );
}
