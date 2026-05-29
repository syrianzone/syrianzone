"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SCALES, DEFAULT_QUESTIONS, Question, Scale } from './data';
import { RotateCw, Share2, Globe, Download, Copy, X } from 'lucide-react';
import { Twitter } from '@/components/ui/icons';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CompassApp() {
    const [started, setStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<{ [key: number]: number }>({});
    const [finished, setFinished] = useState(false);
    const [results, setResults] = useState<{ [key: string]: number }>({});
    const [cachedQuestions, setCachedQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
    const [loading, setLoading] = useState(false); // Can be used if fetching from URL
    const resultsRef = useRef<HTMLDivElement>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);

    // Shuffle questions on load
    useEffect(() => {
        const shuffled = [...DEFAULT_QUESTIONS].sort(() => Math.random() - 0.5);
        setCachedQuestions(shuffled);
    }, []);

    const handleStart = () => {
        setStarted(true);
    };

    const handleAnswer = (value: number) => {
        setAnswers(prev => ({ ...prev, [currentQuestionIndex]: value }));

        // Auto advance after short delay if it's not the last question? 
        // Original app required manual "Next" but selecting an answer didn't auto advance.
        // Let's stick to "Next" button for explicit confirmation, OR provide better UX.
        // Original UX: Click answer, then click Next.
    };

    const handleNext = () => {
        if (answers[currentQuestionIndex] === undefined) {
            alert("الرجاء اختيار إجابة قبل المتابعة");
            return;
        }

        if (currentQuestionIndex < cachedQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            calculateResults();
        }
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const calculateResults = () => {
        const calculatedResults: { [key: string]: number } = {};
        const totals: { [key: string]: number } = {};

        SCALES.forEach((scale) => {
            calculatedResults[scale.id] = 0;
            totals[scale.id] = 0;
        });

        cachedQuestions.forEach((question, index) => {
            if (answers[index] !== undefined) {
                const answerValue = answers[index];
                const effectValue = question.effect;

                calculatedResults[question.category] += answerValue * effectValue;
                totals[question.category]++;
            }
        });

        // Normalize
        SCALES.forEach((scale) => {
            if (totals[scale.id] > 0) {
                const maxValue = totals[scale.id] * 2;
                calculatedResults[scale.id] = calculatedResults[scale.id] / maxValue;
            }
        });

        setResults(calculatedResults);
        setFinished(true);
        window.scrollTo(0, 0);
    };

    const handleRestart = () => {
        setAnswers({});
        setCurrentQuestionIndex(0);
        setFinished(false);
        setResults({});
        setStarted(false);
        // Reshuffle
        setCachedQuestions([...DEFAULT_QUESTIONS].sort(() => Math.random() - 0.5));
    };

    const getRating = (value: number, scale: Scale) => {
        const percentage = ((value + 1) / 2) * 100;
        if (percentage <= 10) return scale.right + " جداً";
        if (percentage <= 30) return scale.right;
        if (percentage <= 45) return "يميل إلى " + scale.right;
        if (percentage <= 55) return "محايد";
        if (percentage <= 70) return "يميل إلى " + scale.left;
        if (percentage <= 90) return scale.left;
        return scale.left + " جداً";
    };

    const handleShare = async () => {
        setShareModalOpen(true);
    };

    const downloadResultImage = async (scaleWidth: number) => {
        if (resultsRef.current) {
            const canvas = await html2canvas(resultsRef.current, {
                scale: 2, // High resolution capture
                backgroundColor: '#ffffff'
            } as any);

            // Scale if needed (simple canvas scaling)
            const scaledCanvas = document.createElement('canvas');
            const aspectRatio = canvas.height / canvas.width;
            scaledCanvas.width = scaleWidth;
            scaledCanvas.height = scaleWidth * aspectRatio;
            const ctx = scaledCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
                const image = scaledCanvas.toDataURL("image/jpeg", 0.9);

                const link = document.createElement("a");
                link.href = image;
                link.download = `sycompass-results-${scaleWidth}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

    if (!started) {
        return (
            <Card className="max-w-2xl mx-auto mb-8">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">مرحباً بك في بوصلة سوريا</CardTitle>
                    <CardDescription className="text-lg">
                        هذا الاختبار يقيس آراءك السياسية على ستة محاور مختلفة تتعلق بمستقبل سوريا.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-muted-foreground">
                        ستُعرض عليك مجموعة من العبارات، وعليك تحديد مدى موافقتك عليها.
                    </p>
                    <div className="bg-muted p-4 rounded-lg">
                        <h3 className="text-xl font-semibold mb-2 text-foreground">المحاور:</h3>
                        <ul className="grid grid-cols-2 gap-2 text-muted-foreground">
                            {SCALES.map(s => <li key={s.id} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {s.name}
                            </li>)}
                        </ul>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleStart}
                        size="lg"
                        className="w-full text-lg font-bold"
                    >
                        ابدأ الاختبار
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (!finished) {
        const question = cachedQuestions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / cachedQuestions.length) * 100;

        return (
            <Card className="max-w-2xl mx-auto mb-8">
                <CardHeader>
                    <CardTitle className="flex justify-between items-center text-sm font-normal text-muted-foreground mb-2">
                        <span>السؤال {currentQuestionIndex + 1} من {cachedQuestions.length}</span>
                    </CardTitle>
                    <CardTitle className="text-xl font-bold text-foreground min-h-[3.5rem]">
                        {question.text}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="my-8">
                        <div className="flex justify-between text-xs text-muted-foreground mb-4 font-medium">
                            <span>أعارض بشدة</span>
                            <span>محايد</span>
                            <span>أوافق بشدة</span>
                        </div>
                        <div className="flex gap-2 sm:gap-4">
                            {[-2, -1, 0, 1, 2].map(val => (
                                <button
                                    key={val}
                                    onClick={() => handleAnswer(val)}
                                    className={`
                                    flex-1 px-2 py-4 sm:px-4 sm:py-3 border rounded-xl transition-all font-bold text-lg
                                    ${answers[currentQuestionIndex] === val
                                            ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105'
                                            : 'bg-muted border-border text-foreground hover:bg-accent'}
                                `}
                                >
                                    {val > 0 ? `+${val}` : val}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between mt-12 gap-4">
                        <Button
                            variant="outline"
                            onClick={handlePrev}
                            disabled={currentQuestionIndex === 0}
                            className="px-8"
                        >
                            السابق
                        </Button>
                        <Button
                            onClick={handleNext}
                            className="px-8 flex-1"
                        >
                            {currentQuestionIndex === cachedQuestions.length - 1 ? "عرض النتائج" : "التالي"}
                        </Button>
                    </div>

                    <div className="mt-8 w-full bg-muted rounded-full h-1.5">
                        <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <Card className="p-8 border-none shadow-xl bg-card" ref={resultsRef}>
                <div className="text-center mb-10">
                    <CardTitle className="text-3xl font-bold text-foreground mb-3">نتائج بوصلة سوريا</CardTitle>
                    <CardDescription className="text-lg">تحليل ميولك السياسية وموقفك من المحاور الوطنية</CardDescription>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {SCALES.map((scale, index) => {
                        const value = results[scale.id];
                        const percentage = ((value + 1) / 2) * 100;
                        const rating = getRating(value, scale);
                        const isReversedColor = index % 2 !== 0; // Just vary colors a bit or stick to standard

                        // Gradient colors per scale (approximate to original)
                        const gradients: { [key: string]: string } = {
                            auth_lib: 'from-green-500 to-red-500', // Lib to Auth? Original: from-red-500 to-green-500? No, left is Lib (green usually)
                            // Original app.js: auth_lib left=lib, right=auth. Canvas drawing might differ.
                            // In app.js: from-red-500 to-green-500. 
                            // Wait, if left is Lib and right is Auth. Usually Auth is Blue/Red, Lib is Green/Yellow. 
                            // Let's stick to the visual style of the original app.

                            // App.js gradients:
                            // auth_lib: red to green 
                            // rel_sec: purple to yellow
                            // soc_cap: red to blue
                            // nat_glob: green to blue
                            // mil_pac: yellow to blue
                            // ret_rec: pink to indigo
                        };
                        const gradientClass = Object.keys(gradients).includes(scale.id)
                            ? gradients[scale.id]
                            : 'from-gray-400 to-gray-600';

                        return (
                            <div key={scale.id} className="space-y-3">
                                <h3 className="text-lg font-bold text-foreground">{scale.name}</h3>
                                <div className="flex justify-between items-end text-sm text-muted-foreground">
                                    <span className="w-24">{scale.left}</span>
                                    <div className="text-center">
                                        <span className="font-bold text-primary block text-base leading-none mb-1">{rating}</span>
                                        <span className="text-xs font-medium opacity-70">نسبة {Math.round(percentage)}%</span>
                                    </div>
                                    <span className="w-24 text-left">{scale.right}</span>
                                </div>
                                <div className="relative w-full h-10 bg-muted rounded-xl overflow-hidden shadow-inner border border-border/50">
                                    <div className={`absolute h-full w-full bg-gradient-to-l ${gradientClass} opacity-90`}></div>
                                    <motion.div
                                        className="absolute w-1.5 h-full bg-foreground border-x-2 border-background shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10"
                                        initial={{ left: "50%" }}
                                        animate={{ left: `${percentage}%` }}
                                        transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.1 }}
                                        style={{ transform: 'translateX(-50%)' }}
                                    ></motion.div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Hide buttons when capturing image via html2canvas if we restrict capture area, 
                    but here we capture 'resultsRef' which wraps everything. 
                    We might want to exclude buttons from the capture. 
                    Simple way: add 'data-html2canvas-ignore' attribute.
                */}
                <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4 pt-8 border-t border-border" data-html2canvas-ignore>
                    <Button
                        onClick={handleRestart}
                        variant="secondary"
                        size="lg"
                        className="gap-2 font-bold"
                    >
                        <RotateCw className="w-5 h-5" /> إعادة الاختبار
                    </Button>
                    <Button
                        onClick={handleShare}
                        size="lg"
                        className="gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Share2 className="w-5 h-5" /> مشاركة النتائج
                    </Button>
                </div>
            </Card>

            {/* Share Modal */}
            <AnimatePresence>
                {shareModalOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="max-w-md w-full shadow-2xl relative overflow-hidden">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>مشاركة النتائج</CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShareModalOpen(false)}
                                    >
                                        <X className="w-6 h-6" />
                                    </Button>
                                </div>
                                <CardDescription>
                                    اختر الحجم المناسب لتحميل الصورة ومشاركتها مع أصدقائك:
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="grid grid-cols-1 gap-3">
                                <Button onClick={() => downloadResultImage(1200)} variant="outline" className="justify-between h-auto py-3">
                                    <span className="flex items-center gap-2"><Download className="w-4 h-4" /> جودة عالية</span>
                                    <span className="text-muted-foreground text-xs">1200px</span>
                                </Button>
                                <Button onClick={() => downloadResultImage(800)} variant="outline" className="justify-between h-auto py-3">
                                    <span className="flex items-center gap-2"><Download className="w-4 h-4" /> جودة متوسطة</span>
                                    <span className="text-muted-foreground text-xs">800px</span>
                                </Button>
                                <Button onClick={() => downloadResultImage(600)} variant="outline" className="justify-between h-auto py-3">
                                    <span className="flex items-center gap-2"><Download className="w-4 h-4" /> جودة منخفضة</span>
                                    <span className="text-muted-foreground text-xs">600px</span>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
