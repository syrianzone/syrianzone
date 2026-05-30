import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import PartyClient from './PartyClient';
import { Organization } from './types';

interface PartyPageProps {
    initialOrganizations: Organization[];
}

export default function PartyPage({ initialOrganizations }: PartyPageProps) {
    return (
        <MainLayout>
            <PartyClient initialOrganizations={initialOrganizations} />
        </MainLayout>
    );
}
