import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import PopulationClient from './PopulationClient';

interface PopulationPageProps {
    masterData?: any;
    envData?: any;
}

export default function PopulationPage({ masterData, envData }: PopulationPageProps) {
    return (
        <MainLayout>
            <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-background">
                <PopulationClient masterData={masterData} envData={envData} />
            </div>
        </MainLayout>
    );
}