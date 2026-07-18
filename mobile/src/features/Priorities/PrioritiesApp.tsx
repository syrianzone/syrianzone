import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ImageDown,
  Link as LinkIcon,
  Minus,
  Plus,
  RotateCcw,
  Share2,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

import { COMPARISONS } from './data';
import {
  analyzeDependencies,
  buildPrioritySummary,
  cloneTopics,
  decodePriorityState,
  priorityPersona,
  priorityShareUrl,
  setTopicPoints,
  toggleSubFile,
  totalPoints,
} from './model';
import { RadarChart } from './RadarChart';
import { StoryExport } from './StoryExport';

const bannerStorageKey = 'sz-priorities-banner-dismissed';

export default function PrioritiesApp() {
  const { theme } = useAppTheme();
  const params = useLocalSearchParams<{ state?: string | string[] }>();
  const sharedState = Array.isArray(params.state) ? params.state[0] : params.state;
  const initialSharedState = useMemo(
    () => sharedState ? decodePriorityState(sharedState) : null,
    [sharedState],
  );
  const [topics, setTopics] = useState(
    () => initialSharedState?.topics ?? cloneTopics(),
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => initialSharedState?.selected ?? new Set(),
  );
  const [comparison, setComparison] = useState('average');
  const [showBanner, setShowBanner] = useState(true);
  const [storyOpen, setStoryOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(
    sharedState
      ? initialSharedState
        ? 'تم تحميل بروفايل الأولويات المشترك.'
        : 'تعذر قراءة بروفايل الأولويات المشترك.'
      : null,
  );
  const total = totalPoints(topics);
  const remaining = 100 - total;
  const dependencies = useMemo(
    () => analyzeDependencies(topics, selected),
    [selected, topics],
  );
  const persona = priorityPersona(topics);
  const comparisonData = COMPARISONS[comparison] ?? COMPARISONS.average!;
  const selectedNames = useMemo(
    () =>
      topics.flatMap((topic) =>
        topic.subFiles
          .filter((subFile) => selected.has(subFile.id))
          .map((subFile) => subFile.name),
      ),
    [selected, topics],
  );

  useEffect(() => {
    let active = true;
    void readStringPreference(bannerStorageKey).then((dismissed) => {
      if (active && dismissed === 'true') {
        setShowBanner(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const changePoints = (id: string, requested: number) => {
    const before = topics.find((topic) => topic.id === id)?.points ?? 0;
    const next = setTopicPoints(topics, id, requested);
    const after = next.find((topic) => topic.id === id)?.points ?? before;
    if (requested > before && after === before) {
      setFeedback('استنفدت النقاط المتاحة. قلل نقاط ملف آخر أولاً.');
    }
    setTopics(next);
  };

  const toggleSelected = (id: string) => {
    const next = toggleSubFile(selected, id);
    if (next === selected && !selected.has(id)) {
      setFeedback('الحد الأقصى هو خمسة ملفات فرعية لضمان التركيز.');
    }
    setSelected(next);
  };

  const requireComplete = (): boolean => {
    if (total !== 100 || !persona) {
      setFeedback('وزع النقاط المئة كاملة قبل النسخ أو التصدير.');
      return false;
    }
    return true;
  };

  const copySummary = async () => {
    if (!requireComplete() || !persona) {
      return;
    }
    const summary = buildPrioritySummary(
      topics,
      selected,
      persona,
      dependencies.label,
    );
    if (!summary) {
      return;
    }
    await Clipboard.setStringAsync(summary);
    setFeedback('تم نسخ ملخص الأولويات.');
  };

  const copyLink = async () => {
    if (!requireComplete()) {
      return;
    }
    await Clipboard.setStringAsync(priorityShareUrl(topics, selected));
    setFeedback('تم نسخ رابط البروفايل الذكي.');
  };

  const sharePlan = async () => {
    if (!requireComplete() || !persona) {
      return;
    }
    const summary = buildPrioritySummary(
      topics,
      selected,
      persona,
      dependencies.label,
    );
    if (summary) {
      await Share.share({
        message: `${summary}\n${priorityShareUrl(topics, selected)}`,
      });
    }
  };

  return (
    <View style={styles.root}>
      {showBanner ? (
        <AppCard style={styles.banner}>
          <AppText color="primary" variant="label">نظام التخطيط المتكامل</AppText>
          <AppText variant="heading">أثر القرارات المتداخلة ومحدودية الموارد</AppText>
          <AppText color="muted">
            وزع 100 نقطة على الملفات الكبرى، ثم اختر أكثر الملفات الفرعية
            إلحاحاً لترى المتطلبات المسبقة والتبعات السيادية والتنموية.
          </AppText>
          <AppButton
            onPress={() => {
              setShowBanner(false);
              void writeStringPreference(bannerStorageKey, 'true');
            }}
            variant="ghost"
          >
            فهمت، إخفاء المقدمة
          </AppButton>
        </AppCard>
      ) : null}

      {feedback ? (
        <AppCard accessibilityLiveRegion="polite" style={styles.feedback}>
          <AppText color="primary" variant="caption">{feedback}</AppText>
        </AppCard>
      ) : null}

      <AppCard style={styles.summary}>
        <AppText variant="heading">1. حدد نقاط الاهتمام والتفاصيل</AppText>
        <AppText color="muted">النقاط المتبقية للموازنة</AppText>
        <AppText color={total === 100 ? 'success' : 'primary'} variant="title">
          {remaining} / 100
        </AppText>
        <View style={[styles.track, { backgroundColor: theme.palette.border }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: theme.palette.primary, width: `${total}%` },
            ]}
          />
        </View>
        {persona ? <AppText color="primary">{persona}</AppText> : null}
      </AppCard>

      {topics.map((topic) => (
        <AppCard key={topic.id} style={styles.topic}>
          <View style={styles.topicHeader}>
            <AppText variant="heading">{topic.emoji} {topic.name}</AppText>
            <AppText color="primary" variant="heading">{topic.points}%</AppText>
          </View>
          <AppText color="muted">{topic.desc}</AppText>
          <View style={styles.stepper}>
            <AppButton
              accessibilityLabel={`تقليل ${topic.name} نقطة واحدة`}
              icon={<Minus color={theme.palette.foreground} size={18} />}
              onPress={() => changePoints(topic.id, topic.points - 1)}
              variant="secondary"
            >
              1
            </AppButton>
            <AppButton
              accessibilityLabel={`زيادة ${topic.name} نقطة واحدة`}
              icon={<Plus color={theme.palette.primaryForeground} size={18} />}
              onPress={() => changePoints(topic.id, topic.points + 1)}
            >
              1
            </AppButton>
          </View>
          <View style={styles.subFiles}>
            {topic.subFiles.map((subFile) => {
              const active = selected.has(subFile.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  key={subFile.id}
                  onPress={() => toggleSelected(subFile.id)}
                  style={({ pressed }) => [
                    styles.subFile,
                    {
                      backgroundColor: active
                        ? theme.palette.surfaceRaised
                        : theme.palette.surface,
                      borderColor: active
                        ? theme.palette.primary
                        : theme.palette.border,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <AppText variant="label">{subFile.name}</AppText>
                  <AppText color="muted" variant="caption">{subFile.desc}</AppText>
                </Pressable>
              );
            })}
          </View>
        </AppCard>
      ))}

      <AppCard style={styles.topic}>
        <AppText variant="heading">2. خريطة الترابط والتعقيد الانتقالي</AppText>
        <AppText color="muted">قارن بروفايلك الخاص مع:</AppText>
        <View style={styles.comparisons}>
          {Object.entries(COMPARISONS).map(([key, item]) => (
            <Pressable
              accessibilityRole="button"
              key={key}
              onPress={() => setComparison(key)}
              style={[
                styles.comparison,
                {
                  backgroundColor:
                    comparison === key
                      ? theme.palette.surfaceRaised
                      : theme.palette.surface,
                  borderColor:
                    comparison === key
                      ? theme.palette.primary
                      : theme.palette.border,
                },
              ]}
            >
              <AppText variant="caption">{item.title}</AppText>
            </Pressable>
          ))}
        </View>
        <RadarChart comparison={comparisonData} topics={topics} />
        <View style={styles.topicHeader}>
          <AppText variant="label">مقياس تداخل وتعقيد رؤيتك</AppText>
          <AppText color="primary">{dependencies.complexity}%</AppText>
        </View>
        <AppText>{dependencies.label}</AppText>
        {dependencies.alerts.length === 0 ? (
          <AppText color="muted" variant="caption">
            اختر الملفات الفرعية لتفعيل خريطة الترابط.
          </AppText>
        ) : (
          dependencies.alerts.map((alert) => (
            <View key={alert.name} style={styles.alert}>
              {alert.fulfilled ? (
                <CheckCircle2 color={theme.palette.success} size={20} />
              ) : (
                <AlertTriangle color={theme.palette.danger} size={20} />
              )}
              <View style={styles.alertCopy}>
                <AppText variant="label">{alert.name}</AppText>
                {alert.warning ? (
                  <AppText color="muted" variant="caption">{alert.warning}</AppText>
                ) : null}
                {!alert.fulfilled ? (
                  <AppText color="danger" variant="caption">
                    يتطلب: {alert.requiredNames.join('، ')}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))
        )}
      </AppCard>

      <AppCard style={styles.exports}>
        <AppText variant="heading">3. تصدير البطاقة ومشاركة الرؤية</AppText>
        <AppText color="muted">
          أنشئ صورة قصة، انسخ الملخص أو الرابط، أو افتح قائمة المشاركة في جهازك.
        </AppText>
        <AppButton
          icon={<ImageDown color={theme.palette.primaryForeground} size={18} />}
          onPress={() => {
            if (requireComplete()) {
              setStoryOpen(true);
            }
          }}
        >
          تصميم صورة ستوري
        </AppButton>
        <AppButton
          icon={<Copy color={theme.palette.foreground} size={18} />}
          onPress={() => void copySummary()}
          variant="secondary"
        >
          نسخ ملخص الأولويات
        </AppButton>
        <AppButton
          icon={<LinkIcon color={theme.palette.foreground} size={18} />}
          onPress={() => void copyLink()}
          variant="secondary"
        >
          نسخ رابط البروفايل
        </AppButton>
        <AppButton
          icon={<Share2 color={theme.palette.primaryForeground} size={18} />}
          onPress={() => void sharePlan()}
        >
          مشاركة الخطة
        </AppButton>
      </AppCard>

      <AppButton
        icon={<RotateCcw color={theme.palette.foreground} size={18} />}
        onPress={() => {
          setTopics(cloneTopics());
          setSelected(new Set());
          setFeedback('تمت إعادة تعيين النقاط والخيارات.');
        }}
        variant="secondary"
      >
        إعادة التعيين
      </AppButton>

      {storyOpen ? (
        <StoryExport
          onClose={() => setStoryOpen(false)}
          open
          persona={persona ?? ''}
          selectedNames={selectedNames}
          topics={topics}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  alertCopy: {
    flex: 1,
    gap: 4,
  },
  banner: {
    gap: 8,
  },
  comparison: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  comparisons: {
    gap: 8,
  },
  exports: {
    gap: 10,
  },
  feedback: {
    paddingVertical: 10,
  },
  fill: {
    height: '100%',
  },
  root: {
    gap: 14,
  },
  stepper: {
    flexDirection: 'row',
    gap: 8,
  },
  subFile: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  subFiles: {
    gap: 8,
  },
  summary: {
    gap: 10,
  },
  topic: {
    gap: 12,
  },
  topicHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  track: {
    borderRadius: 6,
    height: 10,
    overflow: 'hidden',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Priorities/PrioritiesApp.tsx (1596 lines)
  confidence: high
  todos:      0
  notes:      Native controls preserve one-point allocation, shared profiles, radar comparison, copy actions, banner dismissal, and story export.
*/
