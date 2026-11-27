import MainLayout from '@/Layouts/MainLayout';
import PopulationClient, { type PopulationAtlasInitialSummary } from './PopulationClient';

export interface PopulationPageProps {
    initialSummary?: PopulationAtlasInitialSummary | null;
}

export default function PopulationPage({ initialSummary = null }: PopulationPageProps) {
    return (
        <MainLayout>
            <div className="h-[calc(100vh-var(--sz-navbar-h))] overflow-hidden flex flex-col bg-background">
                <PopulationClient initialSummary={initialSummary} />
            </div>
        </MainLayout>
    );
}
