import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, Clock, MapPin, Moon, MoonStar, Settings, Sun, SunDim, Sunrise, Sunset,
} from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import { MUSLIM_GOVERNORATES } from '../_lib/governorates';
import { PRAYER_KEYS, PRAYER_LABELS, PRAYER_METHODS, type PrayerKey } from '../_lib/methods';
import { TRACKED_PRAYERS, todayKey, type MuslimPrefs } from '../_lib/prefs';
import {
  effectivePrayerParams, type LocMode,
} from '../_lib/location';
import LocateButtons from './LocateButtons';
import { syncMuslimUrl, useMuslimNav } from '../_lib/nav';

function prayerIcon(key: string, className?: string) {
  switch (key) {
    case 'Fajr': return <MoonStar className={className} />;
    case 'Sunrise': return <Sunrise className={className} />;
    case 'Dhuhr': return <Sun className={className} />;
    case 'Asr': return <SunDim className={className} />;
    case 'Maghrib': return <Sunset className={className} />;
    case 'Isha': return <Moon className={className} />;
    default: return <Clock className={className} />;
  }
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

interface Props {
  prefs: MuslimPrefs;
  setPrefs: (p: Partial<MuslimPrefs>) => void;
  isLoggedIn: boolean;
}

export default function PrayerTab({ prefs, setPrefs, isLoggedIn }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [timings, setTimings] = useState<Record<string, string> | null>(null);
  const [hijri, setHijri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Fetch via the server proxy (same contract as Roznama/Board widgets).
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(effectivePrayerParams({
      mode: prefs.locMode,
      geo: prefs.geo,
      manualCity: prefs.city,
      method: prefs.method,
      useCustomCoords: prefs.useCustomCoords,
      customLat: prefs.customLat,
      customLon: prefs.customLon,
    }))) params.set(k, String(v));
    fetch(`/api/prayer-times?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error('فشل جلب مواقيت الصلاة');
        return r.json();
      })
      .then((data) => {
        setTimings(data.timings ?? null);
        const h = data.hijri;
        setHijri(h?.day && h?.month && h?.year ? `${h.day} ${h.month} ${h.year}` : null);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e?.message ?? 'حدث خطأ أثناء الاتصال');
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [prefs.city, prefs.useCustomCoords, prefs.customLat, prefs.customLon, prefs.method, prefs.locMode, prefs.geo, nonce]);

  const activeAndNext = useMemo(() => {
    if (!timings) return null;
    const parsed = PRAYER_KEYS.map((key) => {
      const raw = timings[key];
      if (!raw) return null;
      const [h, m] = raw.slice(0, 5).split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      const at = new Date(now);
      at.setHours(h, m, 0, 0);
      return { key: key as PrayerKey, label: PRAYER_LABELS[key as PrayerKey], at };
    }).filter(Boolean) as { key: PrayerKey; label: string; at: Date }[];
    if (parsed.length === 0) return null;
    parsed.sort((a, b) => a.at.getTime() - b.at.getTime());
    const idx = parsed.findIndex((p) => p.at > now);
    if (idx === -1) {
      const first = parsed[0];
      const tmr = new Date(first.at);
      tmr.setDate(tmr.getDate() + 1);
      return { active: parsed[parsed.length - 1], next: { ...first, at: tmr }, diff: tmr.getTime() - now.getTime() };
    }
    return {
      active: parsed[idx === 0 ? parsed.length - 1 : idx - 1],
      next: parsed[idx],
      diff: parsed[idx].at.getTime() - now.getTime(),
    };
  }, [timings, now]);

  // Today's completion log (Asia/Damascus day). Guests keep it in
  // localStorage; logged-in users sync it to their account.
  const dayKey = todayKey(now);
  const doneToday = prefs.prayerLog[dayKey] ?? {};
  const doneCount = (TRACKED_PRAYERS as readonly string[]).filter((k) => doneToday[k]).length;

  const togglePrayer = (key: PrayerKey) => {
    setPrefs({
      prayerLog: {
        ...prefs.prayerLog,
        [dayKey]: { ...doneToday, [key]: !doneToday[key] },
      },
    });
  };

  const usingGeo = (prefs.locMode === 'gps' || prefs.locMode === 'ip') && !!prefs.geo;
  const cityLabel = usingGeo && prefs.geo
    ? prefs.geo.label
    : prefs.useCustomCoords
      ? 'إحداثيات مخصصة'
      : (MUSLIM_GOVERNORATES[prefs.city]?.label ?? prefs.city);

  const setView = useMuslimNav((s) => s.setView);
  const backToIndex = () => {
    setView('index');
    syncMuslimUrl('index');
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={backToIndex} className="gap-1 px-2 text-xs text-muted-foreground">
          <ArrowRight className="h-4 w-4" /> رجوع
        </Button>
      </div>
      <Card className="border-border bg-card/60">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <h3 className="min-w-0 truncate text-lg font-bold">{cityLabel}</h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {hijri && <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{hijri} هـ</Badge>}
              <Badge variant="secondary" dir="ltr" className="text-[10px] tabular-nums lg:hidden">{doneCount}/5</Badge>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" title="إعدادات المواقيت">
                    <Settings className="h-4 w-4" />
                    <span>الإعدادات</span>
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl" className="sm:max-w-md">
                  <DialogHeader className="text-right">
                    <DialogTitle>إعدادات المواقيت</DialogTitle>
                    <DialogDescription>
                      المدينة والإحداثيات وطريقة الحساب — تُستخدم أيضاً في الروزنامة ولوح والرئيسية.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">مصدر الموقع</Label>
                      {([
                        { id: 'gps', title: 'موقع الجهاز (GPS)', desc: 'الأدق — يطلب إذن المتصفح لمرة واحدة' },
                        { id: 'ip', title: 'التعرف عبر الإنترنت', desc: 'تقريبي لمدينتك عبر عنوان IP — بلا أذونات' },
                        { id: 'city', title: 'مدينة يدوية', desc: 'اختر من قائمة المحافظات' },
                      ] as Array<{ id: LocMode; title: string; desc: string }>).map((o) => {
                        const activeOpt = prefs.locMode === o.id;
                        return (
                          <button
                            key={o.id}
                            onClick={() => setPrefs({ locMode: o.id })}
                            aria-pressed={activeOpt}
                            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-right transition-colors ${
                              activeOpt ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 bg-card/20 hover:bg-muted/20'
                            }`}
                          >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${activeOpt ? 'border-primary' : 'border-muted-foreground/40'}`}>
                              {activeOpt && <span className="h-2 w-2 rounded-full bg-primary" />}
                            </span>
                            <span>
                              <span className="block text-xs font-bold">{o.title}</span>
                              <span className="block text-[11px] text-muted-foreground">{o.desc}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {prefs.locMode !== 'city' && (
                      <div className="space-y-2 rounded-lg border border-border/50 bg-card/10 p-3">
                        {prefs.geo ? (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            الموقع الحالي: <span className="font-semibold text-foreground">{prefs.geo.label}</span>
                            <span dir="ltr" className="tabular-nums"> ({prefs.geo.lat}، {prefs.geo.lon})</span>
                          </p>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            لم يُحدد الموقع بعد — استخدم أحد الزرين:
                          </p>
                        )}
                        <LocateButtons />
                      </div>
                    )}

                    {prefs.locMode === 'city' && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin className="h-4 w-4 text-primary" /> المدينة
                        </Label>
                        <Select value={prefs.city} onValueChange={(v) => setPrefs({ city: v })}>
                          <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                          <SelectContent dir="rtl">
                            {Object.entries(MUSLIM_GOVERNORATES).map(([v, g]) => (
                              <SelectItem key={v} value={v}>{g.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <details className="rounded-lg border border-border/50 bg-card/10 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                        إحداثيات يدوية (ملاذ أخير)
                      </summary>
                      <div className="space-y-3 pt-3">
                        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/20 p-3">
                          <span className="text-xs font-medium">تفعيل الإحداثيات المخصصة</span>
                          <Switch checked={prefs.useCustomCoords} onCheckedChange={(c) => setPrefs({ useCustomCoords: c })} />
                        </div>
                        {prefs.useCustomCoords && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">خط العرض (Lat)</Label>
                              <Input dir="ltr" inputMode="decimal" placeholder="33.51" value={prefs.customLat}
                                onChange={(e) => setPrefs({ customLat: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">خط الطول (Lon)</Label>
                              <Input dir="ltr" inputMode="decimal" placeholder="36.27" value={prefs.customLon}
                                onChange={(e) => setPrefs({ customLon: e.target.value })} />
                            </div>
                          </div>
                        )}
                      </div>
                    </details>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">طريقة الحساب</Label>
                      <Select value={String(prefs.method)} onValueChange={(v) => setPrefs({ method: Number(v) })}>
                        <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                          {PRAYER_METHODS.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.nameAr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {PRAYER_METHODS.find((m) => m.id === prefs.method)?.detail}
                        {' — '}الطريقة رأي فقهي: قارن مع مسجدك، وبدّلها إن خالفته.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {activeAndNext && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  {prayerIcon(activeAndNext.next.key, 'h-5 w-5')}
                </div>
                <span className="text-base font-bold text-primary">صلاة {activeAndNext.next.label}</span>
              </div>
              <div className="text-left font-mono">
                <span className="block text-right text-xs font-medium text-muted-foreground">المتبقي</span>
                <span dir="ltr" className="text-xl font-bold tracking-wider text-primary">
                  {formatDuration(activeAndNext.diff)}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-red-500">
              <AlertCircle className="h-8 w-8" /><p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}>إعادة المحاولة</Button>
            </div>
          ) : timings ? (
            <div className="space-y-2">
              {PRAYER_KEYS.map((key) => {
                const isActive = activeAndNext?.active.key === key;
                const isNext = activeAndNext?.next.key === key;
                const trackable = (TRACKED_PRAYERS as readonly string[]).includes(key);
                const checked = trackable && !!doneToday[key];
                return (
                  <div key={key}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-all ${
                      isActive ? 'scale-[1.02] border-primary bg-primary text-primary-foreground shadow-sm'
                      : isNext ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/10'
                      : 'border-border/50 bg-muted/10 hover:bg-muted/20'
                    }`}>
                    <div className="flex min-w-0 items-center gap-3">
                      {prayerIcon(key, `h-4 w-4 shrink-0 ${isActive ? '' : 'text-primary'}`)}
                      <span className="text-sm font-semibold">{PRAYER_LABELS[key]}</span>
                      {isActive && (
                        <Badge className="h-5 bg-primary-foreground px-1.5 text-[10px] font-bold text-primary">الآن</Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span dir="ltr" className="font-mono text-sm font-bold tabular-nums">{timings[key]?.slice(0, 5)}</span>
                      {trackable && (
                        <Button
                          variant="ghost" size="icon"
                          title={checked ? `تمت صلاة ${PRAYER_LABELS[key]} — اضغط للتراجع` : `علّم صلاة ${PRAYER_LABELS[key]} كمنجزة`}
                          onClick={() => togglePrayer(key)}
                          className={`h-7 w-7 rounded-full border transition-colors ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                              : isActive
                                ? 'border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/15'
                                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!isLoggedIn && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              <a href="/auth/google" className="font-semibold text-primary hover:underline">سجّل الدخول</a> لحفظ سجل صلواتك في حسابك.
            </p>
          )}
          <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
            تُحسب المواقيت عبر خادم الموقع (AlAdhan) وتُخزّن مؤقتاً لليوم الحالي بتوقيت دمشق.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
