import React from 'react';
import { Head } from '@inertiajs/react';
import CompassResult from './CompassResult';
import MainLayout from '@/Layouts/MainLayout';
import type { AnswerMap, QuizVersion } from './data/types';

interface Props {
    version: QuizVersion;
    answers: AnswerMap;
    shareId: string;
}

/** Public shared-result page: anyone with the link sees the same card. */
export default function Shared({ version, answers }: Props) {
    return (
        <MainLayout>
            <Head>
                <title>نتيجة مشتركة | بوصلة سوريا</title>
                <meta name="robots" content="noindex" />
            </Head>
            <div className="min-h-screen flex flex-col bg-background text-foreground">
                <section className="bg-card py-8 border-b border-border">
                    <div className="container mx-auto px-4 text-center">
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground">بوصلة سوريا</h1>
                        <p className="text-sm text-muted-foreground mt-1">نتيجة مشتركة</p>
                    </div>
                </section>
                <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 max-w-3xl">
                    <CompassResult
                        answers={answers}
                        version={version}
                        isLoggedIn={false}
                        onRestart={() => {
                            window.location.href = '/compass';
                        }}
                        readOnly
                    />
                </main>
            </div>
        </MainLayout>
    );
}
