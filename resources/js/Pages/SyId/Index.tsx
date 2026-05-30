import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import SyidClient from './SyidClient';
import './page_custom.css';

export default function SyidPage() {
    return (
        <MainLayout>
            <SyidClient />
        </MainLayout>
    );
}
