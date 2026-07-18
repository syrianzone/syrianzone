import { RotateCcw, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { DEFAULT_QUESTIONS, SCALES } from './data';
import {
  calculateCompassResults,
  compassRating,
  shuffleQuestions,
} from './model';

const answerOptions = [-2, -1, 0, 1, 2] as const;

export default function CompassApp() {
  const { theme } = useAppTheme();
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [questions, setQuestions] = useState(() =>
    shuffleQuestions(DEFAULT_QUESTIONS),
  );
  const results = useMemo(
    () => calculateCompassResults(questions, answers),
    [answers, questions],
  );

  const restart = () => {
    setStarted(false);
    setFinished(false);
    setIndex(0);
    setAnswers({});
    setQuestions(shuffleQuestions(DEFAULT_QUESTIONS));
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
        <View style={styles.answerRow}>
          {answerOptions.map((value) => {
            const active = answers[index] === value;
            return (
              <AppButton
                accessibilityLabel={`إجابة ${value}`}
                key={value}
                onPress={() =>
                  setAnswers((current) => ({ ...current, [index]: value }))
                }
                variant={active ? 'primary' : 'secondary'}
              >
                {value > 0 ? `+${value}` : value}
              </AppButton>
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
    <AppCard style={styles.section}>
      <AppText variant="title">نتائج بوصلة سوريا</AppText>
      {SCALES.map((scale) => {
        const value = results[scale.id] ?? 0;
        const percentage = ((value + 1) / 2) * 100;
        return (
          <View key={scale.id} style={styles.result}>
            <AppText variant="label">{scale.name}</AppText>
            <AppText color="primary">{compassRating(value, scale)}</AppText>
            <View style={[styles.resultTrack, { backgroundColor: theme.palette.border }]}>
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: theme.palette.foreground,
                    left: `${Math.max(0, Math.min(100, percentage))}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.ends}>
              <AppText color="muted" variant="caption">{scale.left}</AppText>
              <AppText color="muted" variant="caption">{scale.right}</AppText>
            </View>
          </View>
        );
      })}
      <AppButton
        icon={<Share2 color={theme.palette.primaryForeground} size={18} />}
        onPress={() => void Share.share({ message: `نتائج بوصلة سوريا\n${summary}` })}
      >
        مشاركة النتائج
      </AppButton>
      <AppButton
        icon={<RotateCcw color={theme.palette.foreground} size={18} />}
        onPress={restart}
        variant="secondary"
      >
        إعادة الاختبار
      </AppButton>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  answerRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  marker: {
    height: 24,
    position: 'absolute',
    top: 0,
    width: 3,
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
  result: {
    gap: 6,
  },
  resultTrack: {
    borderRadius: 6,
    height: 24,
    position: 'relative',
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
  notes:      Native cards preserve shuffled questions, scoring, ratings, restart, and sharing.
*/
