import { apiErrorMessage } from '@/Lib/api';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Separator } from '@/Components/ui/separator';
import { RotateCcw, Share2, Trash2, ShieldCheck, AlertTriangle, Save, LogIn, BarChart3 } from 'lucide-react';
import type { AnswerMap, CompassResult as Result, Figure, QuizVersion, Spectrum } from '@/Domain/compass/types';
import { AXES } from '@/Domain/compass/axes';
import { computeScores, computeConsistency, matchFigures, matchSpectrum, versionTotals } from '@/Domain/compass/engine';
import { addResult, clearLocal, saveResultToAccount, updateLocalResult, setPendingAccountSave, deleteAccountResults, deleteAccountResult, submitStats, removeStats } from './lib/storage';
import FigureAvatar from './components/FigureAvatar';
import SpectrumIcon from '@/Domain/compass/SpectrumIcon';
import { COMPASS_FLAGS } from './flags';
import AxisBars from '@/Domain/compass/AxisBars';
import AlignmentCard from '@/Domain/compass/AlignmentCard';
import CompassCanvas from './components/CompassCanvas';
import CompassShareCard from './components/CompassShareCard';
import ShareImageDialog from '@/Components/share/ShareImageDialog';

export default function CompassResult({
  answers,
  version,
  isLoggedIn,
  onRestart,
  onSavedToAccount,
  readOnly = false,
  focusOnMount = false,
  figures = [],
  personas = [],
}: {
  answers: AnswerMap;
  version: QuizVersion;
  isLoggedIn: boolean;
  onRestart: () => void;
  onSavedToAccount?: () => void;
  readOnly?: boolean;
  /** Move focus to the result heading when it replaces in-page content. */
  focusOnMount?: boolean;
  /** Admin-managed roster; only enabled figures are passed in. */
  figures?: Figure[];
  /** Admin-managed personas; only enabled ones are passed in. */
  personas?: Spectrum[];
}) {
  const [saving, setSaving] = useState(false);
  const [statsShared, setStatsShared] = useState(false);
  const [statsToken, setStatsToken] = useState<string | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [savedId, setSavedId] = useState<number | string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const localResultRef = useRef<Result | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The result replaces the quiz (or the saved list): start focus at its heading.
  React.useEffect(() => {
    if (focusOnMount) headingRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const computed = useMemo(() => {
    const { axes, align } = computeScores(answers, version);
    const consistency = computeConsistency(answers, version);
    const { matches, hasStrongMatch } = matchFigures(axes, align, figures);
    const { spectrum, score: spectrumScore } = matchSpectrum(axes, personas);
    const top = matches[0] ?? null;
    const total = versionTotals(version).total;
    const answered = Object.keys(answers).length;
    const rankedAxes = AXES.map((a) => ({ axis: a, value: axes[a.id] }))
      .filter((x) => x.value != null)
      .sort((a, b) => Math.abs(b.value as number) - Math.abs(a.value as number));
    return { axes, align, consistency, matches, hasStrongMatch, spectrum, spectrumScore, top, total, answered, rankedAxes };
  }, [answers, version, figures, personas]);

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
    return r;
  };

  const handleSaveAccount = async () => {
    if (!isLoggedIn) {
      // Queue the run so it is saved automatically once the user is back from
      // the login provider (the React state is lost on the full-page redirect).
      const pending = localResultRef.current
        ? { ...localResultRef.current, statsConsent: statsShared }
        : { ...buildResult(), id: crypto.randomUUID?.() ?? Date.now() };
      setPendingAccountSave(pending);
      window.location.href = '/auth/google?redirect=' + encodeURIComponent('/compass');
      return;
    }
    setSaving(true);
    try {
      const r = await saveResultToAccount(buildResult());
      updateLocalResult(localResultRef.current?.id, {
        id: r?.id ?? localResultRef.current?.id,
        savedToAccount: true,
        statsConsent: statsShared,
      });
      setSavedToAccount(true);
      setSavedId(r?.id ?? null);
      onSavedToAccount?.();
    } catch (e) {
      notify.error(apiErrorMessage(e, 'تعذّر الحفظ في الحساب، بقيت نتيجتك على هذا الجهاز'));
    } finally {
      setSaving(false);
    }
  };

  const handleUnsave = async () => {
    setSaving(true);
    try {
      if (savedId != null) await deleteAccountResult(savedId);
      updateLocalResult(savedId ?? localResultRef.current?.id, { savedToAccount: false });
      setSavedToAccount(false);
      setSavedId(null);
      onSavedToAccount?.();
    } catch (e) {
      notify.error(apiErrorMessage(e, 'تعذّر حذف النتيجة من حسابك'));
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
        updateLocalResult(localResultRef.current?.id, { statsConsent: true });
      } else if (statsToken) {
        await removeStats(statsToken);
        setStatsShared(false);
        setStatsToken(null);
      } else {
        setStatsShared(false);
      }
    } catch (e) {
      notify.error(apiErrorMessage(e, 'تعذّر تحديث المشاركة في الإحصاءات المجهولة'));
    } finally {
      setStatsBusy(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'حذف تقدّمك ونتائجك؟',
      description: isLoggedIn
        ? 'ستُحذف نتائجك المحلية والمحفوظة في حسابك، ولا يمكن التراجع عن ذلك.'
        : 'ستُحذف نتائجك المحفوظة في هذا المتصفح، ولا يمكن التراجع عن ذلك.',
      confirmText: 'حذف',
      destructive: true,
    });
    if (!confirmed) return;
    clearLocal();
    if (isLoggedIn) {
      try {
        await deleteAccountResults();
      } catch (e) {
        notify.error(apiErrorMessage(e, 'تعذّر حذف نتائجك المحفوظة'));
      }
    }
    onRestart();
  };

  // keep a local copy on first render (never auto-saves to the account)
  React.useEffect(() => {
    if (readOnly) return;
    localResultRef.current = persistLocal();
    // Anonymous stats are ON by default: send once on mount. A failed send
    // (e.g. rate limit) leaves the button in the "share" state so the user can retry.
    handleStatsToggle(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = computed.top;
  const spectrum = computed.spectrum;

  return (
    <div className="space-y-4" id="compass-card" dir="rtl">
      <Card className="overflow-hidden">
        <div className="bg-primary/10 border-b border-border px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">طيفك السياسي</p>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-foreground inline-flex items-center gap-2 focus:outline-none">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">موقعك على المحاور</CardTitle>
        </CardHeader>
        <CardContent>
          <AxisBars axes={computed.axes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">توجّهك الخارجي</CardTitle>
        </CardHeader>
        <CardContent>
          <AlignmentCard align={computed.align} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">موقعك على الساحة</CardTitle>
          <CardDescription className="text-xs">مركزي/فدرالي × سلطوية/حرية، مع أقرب الشخصيات.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompassCanvas axes={computed.axes} />
        </CardContent>
      </Card>

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

      <div className="flex flex-col gap-3">
        {readOnly ? (
          <Button variant="secondary" onClick={onRestart} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> خُض الاختبار بنفسك
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-center text-base font-bold text-foreground">مشاركة النتيجة في صورة</p>
              <Button onClick={() => setShareOpen(true)} className="w-full gap-2">
                <Share2 className="w-4 h-4" aria-hidden="true" /> مشاركة صورة النتيجة
              </Button>
            </div>
            <Button variant="secondary" onClick={onRestart} className="w-full gap-2">
              <RotateCcw className="w-4 h-4" /> إعادة
            </Button>
            <Button
              variant="ghost"
              className="text-destructive gap-2"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              احذف تقدّمي ونتائجي المحلية
            </Button>
          </>
        )}
      </div>

      {!readOnly && (
        <ShareImageDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          analyticsModule="compass"
          title="مشاركة نتيجة البوصلة"
          description="اختر المظهر والأبعاد ثم شارك أو حمّل بطاقة نتيجتك."
          filename={`bousalat-syria-${computed.spectrum?.id ?? 'result'}.png`}
          shareTitle="نتيجتي في بوصلة سوريا"
          allowFormatToggle
          defaultFormat="story"
          renderCard={({ themeId, format, cardRef }) => (
            <CompassShareCard
              ref={cardRef}
              spectrum={computed.spectrum}
              axes={computed.axes}
              themeKey={themeId}
              format={format}
            />
          )}
        />
      )}
    </div>
  );
}
