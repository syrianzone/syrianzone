import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Play, Plus, Users, ShieldAlert, HelpCircle, Gamepad2, Layers, Tv } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import axios from 'axios';

interface Category {
  id: number;
  name_ar: string;
  name_en: string;
  slug: string;
  characters_count: number;
}

interface IndexProps {
  categories: Category[];
  total_characters: number;
}

export default function GuessWhoIndex({ categories, total_characters }: IndexProps) {
  const [selectedCat, setSelectedCat] = useState<number | 'random' | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  const getSessionId = () => {
    let sid = localStorage.getItem('guess_who_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem('guess_who_session_id', sid);
    }
    return sid;
  };

  const handleCreateRoom = async () => {
    if (!selectedCat) return;
    setLoading(true);
    try {
      const res = await axios.post('/guesswho/rooms', {
        category_id: selectedCat,
        player_session: getSessionId()
      });
      router.visit(`/guesswho/room/${res.data.room_code}`);
    } catch (err) {
      alert('تعذر إنشاء الغرفة.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    router.visit(`/guesswho/room/${roomCodeInput.trim()}`);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background text-foreground font-sans antialiased pb-16" dir="rtl">
        <Head title="لعبة من هو؟ - Guess Who" />
        
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none blur-3xl rounded-full" />

        <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex p-3.5 bg-primary/10 rounded-3xl border border-primary/20 mb-4 animate-bounce">
              <Gamepad2 className="text-primary h-10 w-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-wide text-foreground flex items-center justify-center gap-3">
              لعبة مَنْ هُوَ؟
            </h1>
            <p className="text-muted-foreground mt-3 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              تحدّ صديقك في لعبة التخمين الشهيرة بالاتصال المباشر! اطرح الأسئلة الذكية واستبعد الشخصيات لتكشف بطاقة خصمك السرية أولاً.
            </p>
          </div>

          {/* Game Menu Card */}
          <Card className="bg-card/75 backdrop-blur-md border-border text-card-foreground rounded-3xl shadow-2xl overflow-hidden mb-12">
            {/* Console Tab Switcher */}
            <div className="flex border-b border-border bg-muted/40 p-2 gap-2">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-sm md:text-base transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'create'
                    ? 'bg-card text-primary shadow-sm border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                }`}
              >
                <Plus className="h-4 w-4" /> إنشاء تحدٍّ جديد
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-sm md:text-base transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'join'
                    ? 'bg-card text-primary shadow-sm border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                }`}
              >
                <Play className="h-4 w-4" /> انضمام لغرفة قائمة
              </button>
            </div>

            <CardContent className="p-6 md:p-8">
              {activeTab === 'create' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground mb-1">اختر فئة الشخصيات</h3>
                    <p className="text-xs text-muted-foreground mb-4">سيتم سحب ٢٤ شخصية من الفئة المحددة بشكل متطابق لك ولخصمك.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[340px] overflow-y-auto pr-1">
                      {/* Random Mix */}
                      {total_characters >= 12 && (
                        <button
                          onClick={() => setSelectedCat('random')}
                          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 ${
                            selectedCat === 'random'
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                              : 'border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Layers className={`h-5 w-5 ${selectedCat === 'random' ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="font-extrabold text-base">عشوائي من كل الفئات</span>
                          </div>
                          <div className="flex justify-between items-center w-full">
                            <span className="text-xs text-muted-foreground">خليط عشوائي ممتع</span>
                            <Badge variant="outline" className={selectedCat === 'random' ? 'border-primary/40 text-primary bg-primary/5' : 'bg-background'}>
                              {total_characters} شخصية متاحة
                            </Badge>
                          </div>
                        </button>
                      )}

                      {/* Categories List */}
                      {categories.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                          لا توجد فئات متاحة حالياً.
                        </div>
                      ) : (
                        categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCat(cat.id)}
                            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 ${
                              selectedCat === cat.id
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                                : 'border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Tv className={`h-5 w-5 ${selectedCat === cat.id ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="font-extrabold text-base">{cat.name_ar}</span>
                            </div>
                            <div className="flex justify-between items-center w-full">
                              <span className="text-xs text-muted-foreground">لعب ببطاقات الفئة المخصصة</span>
                              <Badge variant="outline" className={selectedCat === cat.id ? 'border-primary/40 text-primary bg-primary/5' : 'bg-background'}>
                                {cat.characters_count} شخصية
                              </Badge>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateRoom}
                    disabled={!selectedCat || loading}
                    className="w-full py-7 bg-primary text-primary-foreground hover:bg-primary/90 font-black rounded-2xl text-lg shadow-xl shadow-primary/15 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'جاري إنشاء الغرفة وتحميل الشخصيات...' : 'أنشئ غرفة اللعب الآن'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6 max-w-md mx-auto py-4">
                  <form onSubmit={handleJoinRoom} className="space-y-5">
                    <div className="text-center">
                      <h3 className="text-lg font-extrabold text-foreground mb-1">انضم إلى صديقك</h3>
                      <p className="text-xs text-muted-foreground">أدخل رمز الغرفة المكون من الأحرف الذي شاركه معك صديقك.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block">رمز الغرفة (Room Code):</label>
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={e => setRoomCodeInput(e.target.value)}
                        placeholder="أدخل الرمز هنا (مثال: AB12)"
                        className="w-full bg-muted/40 border border-input rounded-2xl p-4 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-center font-mono text-xl uppercase tracking-widest placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:tracking-normal"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full py-6 font-black rounded-2xl text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      انضم للعب فوراً
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guide Section */}
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-2 justify-center text-foreground font-black text-2xl">
              <HelpCircle className="text-primary h-6 w-6" />
              <h3>كيف تلعب لعبة "من هو؟"؟</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <Card className="bg-card/50 border-border/80 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center font-black text-primary text-lg">١</div>
                <span className="font-extrabold text-base text-foreground">اختر بطلاً سرياً</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يختار كل لاعب بطاقة بطل سرّي في بداية اللعبة. هدف خصمك هو معرفة من هو بطلّك السري، والعكس صحيح!
                </p>
              </Card>

              {/* Step 2 */}
              <Card className="bg-card/50 border-border/80 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center font-black text-primary text-lg">٢</div>
                <span className="font-extrabold text-base text-foreground">اطرح أسئلة ذكية</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تبادل الأسئلة التي يُجاب عليها بـ "نعم" أو "لا" (مثلاً: "هل بطلّك لديه لحية؟"). استبعد الشخصيات بالنقر عليها وتظليلها بناءً على الإجابة.
                </p>
              </Card>

              {/* Step 3 */}
              <Card className="bg-card/50 border-border/80 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center font-black text-primary text-lg">٣</div>
                <span className="font-extrabold text-base text-foreground">خَمِّن البطل لتفوز</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  عندما يتبقى لديك بطل واحد محتمل وتتأكد من إجابتك، استخدم زر "تخمين الشخصية". التخمين الصحيح يفوزك باللعبة مباشرة!
                </p>
              </Card>
            </div>

            {/* Note */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl flex gap-3 text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p>
                <strong>تنويه للاتصال:</strong> نستخدم تقنية WebRTC الحديثة لتوصيل البيانات مباشرة بين أجهزتكم (P2P). يفضل استخدام وسيلة اتصال صوتية أو مرئية خارجية مع صديقك أثناء اللعب للتحدث وطرح الأسئلة بشكل تفاعلي.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
