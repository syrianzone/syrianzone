import MainLayout from '@/Layouts/MainLayout';
import type { SyidFacts } from '@/Domain/syid/facts';
import SyidClient from './SyidClient';
import './page_custom.css';

interface SyidPageProps {
    syid?: SyidFacts;
}

export default function SyidPage({ syid }: SyidPageProps) {
    return (
        <MainLayout>
            <SyidClient syid={syid} />
        </MainLayout>
    );
}
