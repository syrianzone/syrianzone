import { Download, RotateCcw, Share2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { DEFAULT_QUESTIONS, SCALES } from './data';
import {
  calculateCompassResults,
  compassRating,
  shuffleQuestions,
} from './model';
import { ResultGauge } from './ResultGauge';
import { shareCompassResultCard } from './sharing';

// Same order and wording as the web legend above the answer buttons.
const answerOptions = [
  { label: 'أعارض بشدة', value: -2 },
  { label: 'أعارض', value: -1 },
  { label: 'محايد', value: 0 },
  { label: 'أوافق', value: 1 },
  { label: 'أوافق بشدة', value: 2 },
] as const;

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export default function CompassApp() {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState(() =>
    shuffleQuestions(DEFAULT_QUESTIONS),
  );
  const resultCard = useRef<View>(null);
  const results = useMemo(
    () => calculateCompassResults(questions, answers),
    [answers, questions],
  );

  const restart = () => {
    setStarted(false);
    setFinished(false);
    setIndex(0);
    setAnswers({});
    setExportMessage(null);
    setQuestions(shuffleQuestions(DEFAULT_QUESTIONS));
  };

  const exportCard = async () => {
    if (!resultCard.current) {
      return;
    }
    setExporting(true);
    setExportMessage(null);
    try {
      const shared = await shareCompassResultCard(resultCard.current);
      setExportMessage(
        shared
          ? 'تم تجهيز صورة النتيجة وفتح خيارات المشاركة.'
          : 'المشاركة غير متاحة على هذا الجهاز.',
      );
    } catch {
      setExportMessage('تعذر إنشاء صورة النتيجة. حاول مرة أخرى.');
    } finally {
      setExporting(false);
    }
  };

  if (!started) {
    return (
      <AppCard style={styles.section}>
        <AppText variant="heading">مرحباً بك في بوصلة سوريا</AppText>
        <AppText color="muted">
          يقيس الاختبار آراءك السياسية على ستة محاور مرتبطة بمستقبل سوريا.
        </AppText>
        <View style={styles.scaleList}>
          {SCALES.map((scale) => (
            <AppText key={scale.id}>• {scale.name}</AppText>
          ))}
        </View>
        <AppButton onPress={() => setStarted(true)}>ابدأ الاختبار</AppButton>
      </AppCard>
    );
  }

  if (!finished) {
    const question = questions[index];
    if (!question) {
      return null;
    }
    return (
      <AppCard style={styles.section}>
        <AppText color="muted" variant="caption">
          السؤال {index + 1} من {questions.length}
        </AppText>
        <View style={[styles.progressTrack, { backgroundColor: theme.palette.border }]}>
          <View
            style={[
              styles.progressValue,
              {
                backgroundColor: theme.palette.primary,
                width: `${((index + 1) / questions.length) * 100}%`,
              },
            ]}
          />
        </View>
        <AppText variant="heading">{question.text}</AppText>
        <View
          style={[
            styles.answerRow,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
          ]}
          testID="compass-answers"
        >
          {answerOptions.map((option) => {
            const active = answers[index] === option.value;
            return (
              <View key={option.value} style={styles.answerOption}>
                <AppButton
                  accessibilityLabel={`${option.label} ${signed(option.value)}`}
                  onPress={() =>
                    setAnswers((current) => ({
                      ...current,
                      [index]: option.value,
                    }))
                  }
                  variant={active ? 'primary' : 'secondary'}
                >
                  {signed(option.value)}
                </AppButton>
                <AppText
                  color={active ? 'primary' : 'muted'}
                  style={styles.answerLabel}
                  variant="caption"
                >
                  {option.label}
                </AppText>
              </View>
            );
          })}
        </View>
        <View style={styles.navigation}>
          <AppButton
            disabled={index === 0}
            onPress={() => setIndex((current) => Math.max(0, current - 1))}
            variant="secondary"
          >
            السابق
          </AppButton>
          <AppButton
            disabled={answers[index] === undefined}
            onPress={() => {
              if (index === questions.length - 1) {
                setFinished(true);
              } else {
                setIndex((current) => current + 1);
              }
            }}
          >
            {index === questions.length - 1 ? 'عرض النتائج' : 'التالي'}
          </AppButton>
        </View>
      </AppCard>
    );
  }

  const summary = SCALES.map(
    (scale) => `${scale.name}: ${compassRating(results[scale.id] ?? 0, scale)}`,
  ).join('\n');

  return (
    <View style={styles.section}>
      {/* Only the card is captured, so the action buttons stay out of the image. */}
      <View collapsable={false} ref={resultCard}>
        <AppCard style={styles.section}>
          <AppText variant="title">نتائج بوصلة سوريا</AppText>
          <AppText color="muted">
            تحليل ميولك السياسية وموقفك من المحاور الوطنية
          </AppText>
          {SCALES.map((scale) => (
            <ResultGauge
              key={scale.id}
              scale={scale}
              value={results[scale.id] ?? 0}
            />
          ))}
        </AppCard>
      </View>
      {exportMessage ? (
        <AppText color="muted" variant="caption">
          {exportMessage}
        </AppText>
      ) : null}
      <AppButton
        icon={<Download color={theme.palette.primaryForeground} size={18} />}
        loading={exporting}
        onPress={() => void exportCard()}
      >
        مشاركة النتيجة
      </AppButton>
      <AppButton
        icon={<Share2 color={theme.palette.foreground} size={18} />}
        onPress={() => void Share.share({ message: `نتائج بوصلة سوريا\n${summary}` })}
        variant="secondary"
      >
        مشاركة النتائج نصاً
      </AppButton>
      <AppButton
        icon={<RotateCcw color={theme.palette.foreground} size={18} />}
        onPress={restart}
        variant="secondary"
      >
        إعادة الاختبار
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  answerLabel: {
    textAlign: 'center',
  },
  answerOption: {
    flex: 1,
    gap: 4,
  },
  answerRow: {
    gap: 6,
    justifyContent: 'center',
  },
  navigation: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  progressTrack: {
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
  },
  progressValue: {
    height: '100%',
  },
  scaleList: {
    gap: 5,
  },
  section: {
    gap: 18,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Compass/CompassApp.tsx (372 lines)
  confidence: high
  todos:      0
  notes:      Native cards preserve shuffled questions, scoring, ratings, and
              restart. Answer buttons carry the web legend, result gauges show
              the rating plus "نسبة X%", and the JPG download became a captured
              share of the result card.
*/
