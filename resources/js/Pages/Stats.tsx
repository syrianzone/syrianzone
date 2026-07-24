import React from 'react';
import { Head } from '@inertiajs/react';
import { BarChart3, ExternalLink, Sparkles, Activity } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Button } from '@/Components/ui/button';

export default function Stats() {
    const embedUrl = "https://datastudio.google.com/embed/reporting/65f1f763-c5ab-4841-bfba-bd7403d76645/page/KGHXF";

    return (
        <MainLayout>
            <Head>
                <title>إحصائيات المنصة | Platform Statistics</title>
                <meta name="description" content="إحصائيات وتقارير تفاعلية حول المنصة وزوارها والنشاط العام في المساحة السورية." />
            </Head>

            <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl min-h-screen text-foreground">
                {/* Page Header */}
                <div className="text-center mb-8 space-y-4">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2">
                        <BarChart3 className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">إحصائيات المنصة | Platform Statistics</h1>
                    <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
                        تقارير وإحصائيات تفاعلية حول التفاعل والنشاط في المساحة السورية | Interactive statistics and analytics for Syrian Zone
                    </p>
                </div>

                <Tabs defaultValue="ar" className="w-full" dir="rtl">
                    <div className="flex justify-center mb-6">
                        <TabsList className="grid w-[240px] grid-cols-2">
                            <TabsTrigger value="ar" className="font-bold">العربية</TabsTrigger>
                            <TabsTrigger value="en" className="font-bold">English</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Arabic Tab */}
                    <TabsContent value="ar" className="space-y-6 text-right" dir="rtl">
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-primary" />
                                        تقرير الإحصائيات التفاعلي
                                    </CardTitle>
                                    <CardDescription>
                                        بيانات مباشرة ومحدّثة تعكس التفاعل وحركة الزوار عبر أدوات المنصة
                                    </CardDescription>
                                </div>
                                <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
                                    <a href={embedUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-4 h-4" />
                                        <span>فتح في نافذة جديدة</span>
                                    </a>
                                </Button>
                            </CardHeader>
                            <CardContent className="p-2 md:p-4">
                                <div className="relative w-full rounded-xl overflow-hidden border border-border/60 bg-background shadow-inner">
                                    <iframe
                                        src={embedUrl}
                                        width="100%"
                                        height="750"
                                        frameBorder="0"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                        className="w-full min-h-[600px] md:min-h-[750px] rounded-xl"
                                        title="Syrian Zone Analytics Report"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* English Tab */}
                    <TabsContent value="en" className="space-y-6 text-left" dir="ltr">
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-primary" />
                                        Interactive Analytics Dashboard
                                    </CardTitle>
                                    <CardDescription>
                                        Live updated reporting on platform activity and audience engagement
                                    </CardDescription>
                                </div>
                                <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
                                    <a href={embedUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Open in new tab</span>
                                    </a>
                                </Button>
                            </CardHeader>
                            <CardContent className="p-2 md:p-4">
                                <div className="relative w-full rounded-xl overflow-hidden border border-border/60 bg-background shadow-inner">
                                    <iframe
                                        src={embedUrl}
                                        width="100%"
                                        height="750"
                                        frameBorder="0"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                        className="w-full min-h-[600px] md:min-h-[750px] rounded-xl"
                                        title="Syrian Zone Analytics Report EN"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}
