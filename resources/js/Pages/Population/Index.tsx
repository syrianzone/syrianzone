import MainLayout from '@/Layouts/MainLayout';
import PopulationClient from './PopulationClient';

export default function PopulationPage() {
    return (
        <MainLayout>
            
            <div className="h-[calc(100vh-var(--sz-navbar-h))] overflow-hidden flex flex-col bg-background">
                <PopulationClient />
            </div>
        </MainLayout>
    );
}