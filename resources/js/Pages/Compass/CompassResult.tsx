import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Separator } from '@/Components/ui/separator';
import { RotateCcw, Download, Trash2, ShieldCheck, AlertTriangle, Save, LogIn, BarChart3 } from 'lucide-react';
import type { AnswerMap, AlignBloc, CompassResult as Result, QuizVersion } from './data/types';
import { AXES } from './data/axes';
import { computeScores, computeConsistency, matchFigures, matchSpectrum, versionTotals } from './lib/engine';
import { addResult, setLastResultId, clearLocal, saveResultToAccount, deleteAccountResults, deleteAccountResult, submitStats, removeStats } from './lib/storage';
import FigureAvatar from './components/FigureAvatar';
import SpectrumIcon from './components/SpectrumIcon';
import { COMPASS_FLAGS } from './flags';
import AxisBars from './components/AxisBars';
import AlignmentCard from './components/AlignmentCard';
import CompassCanvas from './components/CompassCanvas';
import CompassShareCard from './components/CompassShareCard';
import { exportElementAsPng } from './lib/exportImage';

const BLOC_LABEL: Record<AlignBloc, string> = {
  west: 'غربي',
  gulf: 'خليجي',
  turkish: 'تركي',
  east: 'شرقي',
  neutral: 'حياد',
};

export default function CompassResult({
  answers,
  version,
  isLoggedIn,
  onRestart,
  onSavedToAccount,
  readOnly = false,
}: {
  answers: AnswerMap;
  version: QuizVersion;
  isLoggedIn: boolean;
  onRestart: () => void;
  onSavedToAccount?: () => void;
  readOnly?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [statsShared, setStatsShared] = useState(false);
  const [statsToken, setStatsToken] = useState<string | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [savedId, setSavedId] = useState<number | string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [themeKey, setThemeKey] = useState('dark');
  const storyCardRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => {
    const { axes, align } = computeScores(answers, version);
    const consistency = computeConsistency(answers, version);
    const { matches, hasStrongMatch } = matchFigures(axes, align);
    const { spectrum, score: spectrumScore } = matchSpectrum(axes);
    const top = matches[0] ?? null;
    const total = versionTotals(version).total;
    const answered = Object.keys(answers).length;
    // strongest / weakest axes (by |value|)
    const rankedAxes = AXES.map((a) => ({ axis: a, value: axes[a.id] }))
      .filter((x) => x.value != null)
      .sort((a, b) => Math.abs(b.value as number) - Math.abs(a.value as number));
    return { axes, align, consistency, matches, hasStrongMatch, spectrum, spectrumScore, top, total, answered, rankedAxes };
  }, [answers, version]);

  const buildResult = (): Result => ({
    version,
    scores: computed.axes,
    align: computed.align,
    answers,
    topFigure: computed.top?.figure.name ?? null,
    topScore: computed.top?.score ?? null,
    spectrum: computed.spectrum?.id ?? null,
    consistency: computed.consistency,
    answered: computed.answered,
    createdAt: new Date().toISOString(),
  });

  /** Always keep a local copy so the run appears in local history. */
  const persistLocal = (extra: Partial<Result> = {}) => {
    const r = { ...buildResult(), id: crypto.randomUUID?.() ?? Date.now(), ...extra };
    addResult(r);
    setLastResultId(r.id as string);
    return r;
  };

  const handleSaveAccount = async () => {
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    setSaving(true);
    try {
      const r = await saveResultToAccount(buildResult());
      persistLocal({ savedToAccount: true, statsConsent: statsShared });
      setSavedToAccount(true);
      setSavedId(r?.id ?? null);
      onSavedToAccount?.();
    } catch {
      // keep local only
    } finally {
      setSaving(false);
    }
  };

  const handleUnsave = async () => {
    setSaving(true);
    try {
      if (savedId != null) await deleteAccountResult(savedId);
      setSavedToAccount(false);
      setSavedId(null);
      onSavedToAccount?.();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  /** Anonymous stats (default-on). Click sends; click again removes via token. */
  const handleStatsToggle = async (on: boolean) => {
    setStatsBusy(true);
    try {
      if (on) {
        const token = await submitStats(buildResult());
        setStatsToken(token);
        setStatsShared(true);
        persistLocal({ statsConsent: true });
      } else if (statsToken) {
        await removeStats(statsToken);
        setStatsShared(false);
        setStatsToken(null);
      } else {
        setStatsShared(false);
      }
    } catch {
      // keep current state on failure
    } finally {
      setStatsBusy(false);
    }
  };

  const handleDelete = async () => {
    clearLocal();
    if (isLoggedIn) {
      try {
        await deleteAccountResults();
      } catch {}
    }
    setConfirmDelete(false);
    onRestart();
  };

  const handleDownloadImage = async () => {
    if (!storyCardRef.current) return;
    setImageBusy(true);
    try {
      await exportElementAsPng(storyCardRef.current, `bousalat-syria-${Date.now()}.png`);
    } catch (e) {
      console.error('compass image export failed', e);
    } finally {
      setImageBusy(false);
    }
  };

  // Track the active theme so the share card matches it.
  React.useEffect(() => {
    const read = () => setThemeKey(document.documentElement.getAttribute('data-theme') || 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // keep a local copy on first render (never auto-saves to the account)
  React.useEffect(() => {
    if (readOnly) return;
    persistLocal();
    // Anonymous stats are ON by default: send once on mount. A failed send
    // (e.g. rate limit) leaves the button in the "share" state so the user can retry.
    handleStatsToggle(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = computed.top;
  const spectrum = computed.spectrum;

  return (
    <div className="space-y-4" id="compass-card" dir="rtl">
      {/* ---- Header: spectrum + match ---- */}
      <Card className="overflow-hidden">
        <div className="bg-primary/10 border-b border-border px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">طيفك السياسي</p>
          <h2 className="text-2xl font-extrabold text-foreground inline-flex items-center gap-2">
            <SpectrumIcon name={spectrum?.icon} className="w-6 h-6 text-primary" />
            {spectrum?.name}
          </h2>
          {spectrum && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md mx-auto">
              {spectrum.short}
            </p>
          )}
        </div>
        <CardContent className="pt-4 space-y-4">
          {/* Closest figure — only when character names are enabled. */}
          {COMPASS_FLAGS.showCharacterNames && top && (
            <div>
              <div className="flex items-center gap-4">
                <FigureAvatar
                  name={top.figure.name}
                  category={top.figure.category}
                  image={top.figure.image}
                  size={72}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">أقرب شخصية إليك</p>
                  <p className="font-bold text-lg truncate">{top.figure.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.round(top.score * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-primary">{Math.round(top.score * 100)}%</span>
                  </div>
                </div>
              </div>
              {!computed.hasStrongMatch && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    لا توجد شخصية قريبة بدرجة كافية (أقوى توافق {Math.round(top.score * 100)}%).
                    إجاباتك قد تكون متضاربة أو خارج التجمعات المعروفة.
                  </span>
                </div>
              )}
            </div>
          )}

          {spectrum && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">لمحة تاريخية</p>
              <p className="text-sm leading-relaxed text-foreground/90">{spectrum.factoid}</p>
            </div>
          )}

          {spectrum && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">مواقفك الأساسية</p>
              <div className="flex flex-wrap gap-2">
                {spectrum.stances.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Axis bars ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">موقعك على المحاور</CardTitle>
        </CardHeader>
        <CardContent>
          <AxisBars axes={computed.axes} />
        </CardContent>
      </Card>

      {/* ---- Alignment ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">توجّهك الخارجي</CardTitle>
        </CardHeader>
        <CardContent>
          <AlignmentCard align={computed.align} label={BLOC_LABEL} />
        </CardContent>
      </Card>

      {/* ---- 2D compass ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">موقعك على الساحة</CardTitle>
          <CardDescription className="text-xs">مركزي/فدرالي × سلطوية/حرية، مع أقرب الشخصيات.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompassCanvas axes={computed.axes} />
        </CardContent>
      </Card>

      {/* ---- Stats ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">إحصاءات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> درجة الاتساق
            </span>
            <span className="font-bold">{Math.round(computed.consistency * 100)}%</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">الأسئلة المُجابة</span>
            <span className="font-bold">{computed.answered} / {computed.total}</span>
          </div>
          <Separator />
          {computed.rankedAxes[0] && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">أقوى محور</span>
              <span className="font-bold">
                {computed.rankedAxes[0].axis.name}{' '}
                <span className="text-primary">
                  ({(computed.rankedAxes[0].value as number) > 0
                    ? computed.rankedAxes[0].axis.right
                    : computed.rankedAxes[0].axis.left})
                </span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Anonymous stats (default-on): title above, red remove button ---- */}
      {!readOnly && statsShared && (
        <div className="space-y-2">
          <p className="text-center text-base font-bold text-foreground leading-snug">
            نتيجتك مشتركة مجهولة الهوية (بلا حساب ولا اسم). اضغط الإزالة لسحبها.
          </p>
          <Button
            variant="destructive"
            onClick={() => handleStatsToggle(false)}
            disabled={statsBusy}
            className="w-full gap-2"
          >
            <BarChart3 className="w-4 h-4" /> إزالة مشاركتي المجهولة
          </Button>
        </div>
      )}

      {/* ---- Save to account: title above, primary save button ---- */}
      {!readOnly && isLoggedIn && (
        <div className="space-y-2">
          <p className="text-center text-base font-bold text-foreground leading-snug">
            {savedToAccount
              ? 'محفوظة في حسابك. اضغط الإزالة لحذفها.'
              : 'احفظها لمتابعتها ومراجعتها لاحقاً من حسابك.'}
          </p>
          <Button
            variant={savedToAccount ? 'destructive' : 'default'}
            onClick={savedToAccount ? handleUnsave : handleSaveAccount}
            disabled={saving}
            className="w-full gap-2"
          >
            {savedToAccount ? <Trash2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedToAccount ? 'إزالة النتيجة من حسابي' : 'احفظ النتيجة في حسابي'}
          </Button>
        </div>
      )}

      {!readOnly && !isLoggedIn && (
        <Button variant="outline" onClick={handleSaveAccount} className="w-full gap-2">
          <LogIn className="w-4 h-4 text-primary" /> سجّل الدخول لحفظ النتيجة
        </Button>
      )}

      {/* ---- Actions ---- */}
      <div className="flex flex-col gap-3">
        {readOnly ? (
          <Button variant="secondary" onClick={onRestart} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> خُض الاختبار بنفسك
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-center text-base font-bold text-foreground">مشاركة النتيجة في صورة</p>
              <Button onClick={handleDownloadImage} disabled={imageBusy} className="w-full gap-2">
                <Download className="w-4 h-4" /> {imageBusy ? 'يعمل…' : 'مشاركة'}
              </Button>
            </div>
            <Button variant="secondary" onClick={onRestart} className="w-full gap-2">
              <RotateCcw className="w-4 h-4" /> إعادة
            </Button>
            <Button
              variant="ghost"
              className="text-destructive gap-2"
              onClick={() => (confirmDelete ? handleDelete() : setConfirmDelete(true))}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'اضغط مرة أخرى للتأكيد' : 'احذف تقدّمي ونتائجي المحلية'}
            </Button>
          </>
        )}
      </div>

      {/* Off-screen story card captured by html2canvas-pro for image sharing. */}
      {!readOnly && (
        <div aria-hidden style={{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none', zIndex: -1 }}>
          <CompassShareCard
            ref={storyCardRef}
            spectrum={computed.spectrum}
            axes={computed.axes}
            themeKey={themeKey}
          />
        </div>
      )}
    </div>
  );
}
