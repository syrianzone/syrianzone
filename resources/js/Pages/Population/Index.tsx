import MainLayout from '@/Layouts/MainLayout';
import PopulationClient from './PopulationClient';

export default function PopulationPage() {
    return (
        <MainLayout>
            
            <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-background">
                <PopulationClient />
            </div>
        </MainLayout>
    );
}