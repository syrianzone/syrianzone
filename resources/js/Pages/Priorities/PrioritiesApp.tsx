import React, { useState, useEffect, useRef, useMemo } from 'react';
import { notify } from '@/Lib/notify';
import { copyText } from '@/Lib/copy';
import BrandShareFrame, { MADAR_DISPLAY_FONT, MADAR_MONO_FONT } from '@/Components/share/BrandShareFrame';
import ShareImageDialog from '@/Components/share/ShareImageDialog';

// recharts draws nothing on the server (ResponsiveContainer has no size there)
// and is the page's heaviest dependency, so the radar loads on demand inside
// its fixed-height box.
const PrioritiesRadar = React.lazy(() => import('./_components/PrioritiesRadar'));
import {
  RotateCcw,
  Share2,
  Copy,
  Link as LinkIcon,
  SlidersHorizontal,
  AlertTriangle,
  GitFork,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  CheckCircle2,
  Scale,
  Briefcase,
  Home,
  Shield,
  Landmark,
  Globe,
  Check
} from 'lucide-react';
import { Instagram } from '@/Components/ui/icons';

import { Card } from "@/Components/ui/card";
import { THEME_REGISTRY, getThemeById, hexToRgbString, useThemeId } from '@/Lib/theme';
import { Button } from "@/Components/ui/button";

import {
  INITIAL_TOPICS,
  COMPARISONS,
  DEPENDENCIES,
  Topic,
  SubFile
} from './data';
import { decodeShareState, encodeShareState, shareStateUrl } from './shareState';

const TOPIC_ICONS: Record<string, React.ComponentType<any>> = {
  economy: Briefcase,
  justice: Scale,
  housing: Home,
  security: Shield,
  politics: Landmark,
  digital: Globe,
};

const getShortTopicName = (id: string, fallback: string) => {
  if (id === 'economy') return 'الاقتصاد';
  if (id === 'justice') return 'العدالة';
  if (id === 'housing') return 'السكن';
  if (id === 'security') return 'الأمن';
  if (id === 'politics') return 'السياسة';
  if (id === 'digital') return 'الرقمنة';
  return fallback;
};

const BUDGET_LIMIT = 100;
const MAX_SUBFILES_CHECKED = 5;

export default function PrioritiesApp() {
  const [topics, setTopics] = useState<Topic[]>(INITIAL_TOPICS.map(t => ({ ...t })));
  const [selectedSubFiles, setSelectedSubFiles] = useState<Set<string>>(new Set());
  const [activeComparisonKey, setActiveComparisonKey] = useState<string>('average');
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const activeTheme = useThemeId();
  const [isStoryModalOpen, setIsStoryModalOpen] = useState<boolean>(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(['economy', 'justice', 'housing', 'security', 'politics', 'digital']));

  const [showWarning, setShowWarning] = useState<boolean>(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem('sz-priorities-banner-dismissed') === 'true') setShowBanner(false);
    } catch {
      // Storage can be blocked (private mode, disabled cookies); keep the banner.
    }

    const stateParam = new URLSearchParams(window.location.search).get('state');
    const shared = stateParam ? decodeShareState(stateParam, {
      topics: INITIAL_TOPICS.map(t => t.id),
      subFiles: INITIAL_TOPICS.flatMap(t => t.subFiles.map(s => s.id)),
      budget: BUDGET_LIMIT,
      maxSubFiles: MAX_SUBFILES_CHECKED,
    }) : null;
    if (shared) {
      setTopics(prev => prev.map(t => ({ ...t, points: shared.points[t.id] ?? t.points })));
      setSelectedSubFiles(new Set(shared.subFiles));
    }
  }, []);

  const totalAllocated = useMemo(() => {
    return topics.reduce((sum, t) => sum + t.points, 0);
  }, [topics]);

  const remainingPoints = BUDGET_LIMIT - totalAllocated;

  const triggerWarning = () => {
    setShowWarning(true);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(false);
    }, 4000);
  };

  const onSliderInput = (id: string, value: number) => {
    setTopics(prev => {
      const targetTopic = prev.find(t => t.id === id);
      if (!targetTopic) return prev;

      const currentTotalWithoutTarget = prev.reduce((sum, t) => t.id === id ? sum : sum + t.points, 0);
      const newTotal = currentTotalWithoutTarget + value;

      let finalValue = value;
      if (newTotal > BUDGET_LIMIT) {
        finalValue = BUDGET_LIMIT - currentTotalWithoutTarget;
        triggerWarning();
      }

      return prev.map(t => t.id === id ? { ...t, points: finalValue } : t);
    });
  };

  const changePoints = (id: string, delta: number) => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;
    const newVal = Math.max(0, Math.min(100, topic.points + delta));
    onSliderInput(id, newVal);
  };

  const toggleSubFile = (subId: string, topicId: string) => {
    setSelectedSubFiles(prev => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        if (next.size >= MAX_SUBFILES_CHECKED) {
          notify.warning("⚠️ تم بلوغ الحد الأقصى! يرجى إلغاء تفعيل أحد الملفات الفرعية النشطة أولاً لضمان التركيز الوطني.");
          return prev;
        }
        next.add(subId);
      }
      return next;
    });
  };

  const resetPoints = () => {
    setTopics(INITIAL_TOPICS.map(t => ({ ...t, points: 0 })));
    setSelectedSubFiles(new Set());
    notify.success("🔄 تم إعادة تعيين كافة النقاط والخيارات بنجاح.");
  };

  const toggleTopicDetails = (id: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const dismissBanner = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('sz-priorities-banner-dismissed', 'true');
    } catch {
      // Storage unavailable: the banner just returns on the next visit.
    }
  };

  const interdependencyInfo = useMemo(() => {
    if (selectedSubFiles.size === 0) {
      return {
        complexity: 10,
        label: 'بسيط جداً',
        labelClass: 'text-muted-foreground',
        explanation: 'كلما حددت أولويات نوعية، زاد مؤشر تشابك القرارات على الأرض والاعتماد التبادلي للمؤسسات.',
        alerts: []
      };
    }

    let complexity = 10 + (selectedSubFiles.size * 18);
    const alerts: Array<{
      subId: string;
      subName: string;
      parentId: string;
      parentName: string;
      isFulfilled: boolean;
      warningText: string;
      unsatisfiedNames: string[];
    }> = [];

    selectedSubFiles.forEach(subId => {
      let foundSub: SubFile | null = null;
      let parentTopic: Topic | null = null;
      for (const t of topics) {
        const s = t.subFiles.find(sf => sf.id === subId);
        if (s) {
          foundSub = s;
          parentTopic = t;
          break;
        }
      }
      if (!foundSub || !parentTopic) return;

      const dep = DEPENDENCIES[subId];
      if (dep) {
        complexity += 15;
        const unsatisfied = dep.requires.filter(reqId => !selectedSubFiles.has(reqId));
        const unsatisfiedNames: string[] = [];

        unsatisfied.forEach(reqId => {
          for (const t of topics) {
            const s = t.subFiles.find(sf => sf.id === reqId);
            if (s) unsatisfiedNames.push(s.name);
          }
        });

        alerts.push({
          subId,
          subName: foundSub.name,
          parentId: parentTopic.id,
          parentName: getShortTopicName(parentTopic.id, parentTopic.name),
          isFulfilled: unsatisfied.length === 0,
          warningText: dep.warning,
          unsatisfiedNames
        });
      } else {
        alerts.push({
          subId,
          subName: foundSub.name,
          parentId: parentTopic.id,
          parentName: getShortTopicName(parentTopic.id, parentTopic.name),
          isFulfilled: true,
          warningText: '',
          unsatisfiedNames: []
        });
      }
    });

    complexity = Math.min(complexity, 100);
    let label = 'سهل ومبسط';
    let labelClass = 'text-emerald-600 dark:text-emerald-400 font-extrabold';
    let explanation = 'خطتك بسيطة ومركزة على ملفات محدودة ومستقلة، لكنها قد تهمل مواجهة بعض الجذور المعقدة للمشكلات السيادية.';

    if (complexity >= 35 && complexity < 70) {
      label = 'توازن ديناميكي متوسط';
      labelClass = 'text-amber-600 dark:text-amber-400 font-extrabold';
      explanation = 'خطتك ممتازة وتبين فهماً متطوراً لترابط الملفات. توجد بعض العقبات البيروقراطية أو الأمنية التي تتطلب توازناً إضافياً.';
    } else if (complexity >= 70) {
      label = 'شديد التعقيد والتشابك';
      labelClass = 'text-rose-600 dark:text-rose-400 font-extrabold';
      explanation = 'تخطيطك طموح جداً ويحاول حل قضايا سيادية وقانونية واقتصادية متزامنة. ستحتاج الإدارة القادمة لأقوى أجهزة الرقابة والرقمنة لتفادي انهيار المؤسسات.';
    }

    return {
      complexity,
      label,
      labelClass,
      explanation,
      alerts
    };
  }, [selectedSubFiles, topics]);

  const persona = useMemo(() => {
    if (totalAllocated < 100) return null;

    const sorted = topics.toSorted((a, b) => b.points - a.points);
    const highest = sorted[0];

    const details: Record<string, { emoji: string; tag: string; tagClass: string; title: string; desc: string }> = {
      justice: {
        emoji: '⚖️',
        tag: 'تيار الحقوق والمظالم والتعافي',
        tagClass: 'text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40',
        title: 'حامي دولة القانون والمصالحة المجتمعية',
        desc: 'أنت تعتقد جازماً أن محاسبة مرتكبي الجرائم وكشف مصير المفقودين وجبر خواطر العائلات هي القاعدة الصلبة والوحيدة لبدء البناء والإعمار دون انتكاسات دموية قادمة.'
      },
      economy: {
        emoji: '💼',
        tag: 'التيار التنموي ومكافحة العوز',
        tagClass: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40',
        title: 'مُحرك عجلة الحياة والاقتصاد الحر',
        desc: 'رؤيتك ترتكز على حقيقة أن الجوع والبطالة هما مهد الجريمة والفساد والانهيار. ترغب أولاً في توفير سبل العيش الكريم للشباب وتحفيز الاستثمار والشركات لإنعاش سوريا.'
      },
      housing: {
        emoji: '🏗️',
        tag: 'تيار البناء والإنقاذ الخدمي',
        tagClass: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40',
        title: 'باني مرافق سوريا المستقبل ومأوى المهجرين',
        desc: 'لا عودة للمهجرين واللاجئين في رأيك بلا ترميم فوري، وتجريف للركام، وتنظيم للعشوائيات، وفض للنزاعات العقارية. البناء الخدمي والمنزلي هو المنطلق الحقيقي لبداية الدولة.'
      },
      security: {
        emoji: '🛡️',
        tag: 'تيار الأمن القومي والسيادة المستدامة',
        tagClass: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40 border-red-200 dark:border-red-800/40',
        title: 'مهندس الأمن وسلطة وهيبة القانون',
        desc: 'السلاح المنفلت والمخدرات وحقول الألغام هي في نظرك الخطر الأكبر على الوجود والسيادة السورية. تريد مكافحة فوضى التسلح لتمهيد الطريق للمدارس والمصانع والدبلوماسية لتتحرك.'
      },
      politics: {
        emoji: '🏛️',
        tag: 'تيار الإصلاح الديمقراطي والمواطنة',
        tagClass: 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/40',
        title: 'مخطط الحوكمة الرشيدة والمؤسسات والسيادة',
        desc: 'أصل البلاء في سوريا بالنسبة لك هو البناء السياسي الاستبدادي. تركز بقوة على تشريع الأحزاب الشفافة وحسم ملف التجنيس الحساس ومنع التزوير في السجلات لبناء مجتمع حر ومتساوٍ.'
      },
      digital: {
        emoji: '🌐',
        tag: 'التيار التقني والتحول الرقمي',
        tagClass: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40',
        title: 'مهندس الأنظمة الذكية وسرعة الخدمة',
        desc: 'البيروقراطية الورقية والفساد العقاري هما سبب ضياع الدولة في نظرك. تركز على رقمنة السجل المدني، وتأمين السيرفرات السيادية، والخدمات المصرفية الرقمية لتسريع عجلة التعافي الحديث.'
      }
    };

    const result = details[highest.id] || details.economy;
    return { ...result, id: highest.id };
  }, [totalAllocated, topics]);

  const activeThemeConfig = getThemeById(activeTheme) || getThemeById('dark') || THEME_REGISTRY[2];
  const themeColors = useMemo(() => ({
    primary: activeThemeConfig.primary,
    primaryRgb: hexToRgbString(activeThemeConfig.primary)
  }), [activeThemeConfig]);

  const chartData = useMemo(() => {
    const topicLabels: Record<string, string> = {
      economy: 'الاقتصاد',
      justice: 'العدالة',
      housing: 'السكن',
      security: 'الأمن',
      politics: 'السياسة',
      digital: 'الرقمنة'
    };
    return topics.map(t => ({
      topic: topicLabels[t.id] || t.name,
      current: t.points,
      comparison: COMPARISONS[activeComparisonKey]?.points[t.id] || 0
    }));
  }, [topics, activeComparisonKey]);

  const isDark = Boolean(getThemeById(activeTheme)?.isDark);
  const labelColor = isDark ? '#ffffff' : '#475569';

  const handleCopyText = () => {
    if (totalAllocated < 100) {
      notify.warning("⚠️ يرجى إتمام موازنة الـ 100 نقطة كاملة قبل النسخ!");
      return;
    }

    const personaName = persona?.title || "";
    let textToCopy = `🇸🇾 *بروفايل أولوياتي التوافقية لمستقبل سوريا ما بعد التحرير* 🇸🇾\n`;
    textToCopy += `لقد قمت بموازنة الـ 100 نقطة اهتمام، وحصلت على بروفايل: *"${personaName}"*\n\n`;
    textToCopy += `💡 *ترتيب الأولويات الثلاث الكبرى لدي:* \n`;

    const sortedTopics = topics.toSorted((a, b) => b.points - a.points);
    sortedTopics.slice(0, 3).forEach((t, i) => {
      textToCopy += `${i + 1}. ${t.emoji} ${t.name}: %${t.points} \n`;
    });

    if (selectedSubFiles.size > 0) {
      textToCopy += `\n🎯 *الملفات الفرعية الأكثر إلحاحاً في خطتي:* \n`;
      selectedSubFiles.forEach(subId => {
        for (const t of topics) {
          const s = t.subFiles.find(sf => sf.id === subId);
          if (s) textToCopy += ` - ${s.name}\n`;
        }
      });
    }

    textToCopy += `\n📊 *مقياس تداخل وتعقيد رؤيتي التخطيطية:* ${interdependencyInfo.label}\n`;
    textToCopy += `\n🔗 قم بموازنة أولوياتك وفك شفرة تداخل الملفات السيادية والتنموية معنا!`;

    void copyText(textToCopy, {
      successMessage: "✅ تم نسخ النص الإحصائي بنجاح! يمكنك الآن لصقه ومشاركته فوراً على مجموعات فيسبوك أو تيليغرام لنشر النقاش العقلاني.",
      failureMessage: "⚠️ فشل في نسخ النص.",
    });
  };

  const handleCopyLink = () => {
    if (totalAllocated < 100) {
      notify.warning("⚠️ يرجى توزيع كافة النقاط وتجاوز الـ 100 نقطة أولاً لنسخ رابطك!");
      return;
    }

    const encoded = encodeShareState(Object.fromEntries(topics.map(t => [t.id, t.points])), [...selectedSubFiles]);
    const shareUrl = shareStateUrl(window.location, encoded);

    void copyText(shareUrl, {
      successMessage: "🔗 تم نسخ رابط بروفايلك الخاص المشفّر بنجاح! يمكن لزوار الرابط تصفح ومقارنة اختياراتك بدقة.",
      failureMessage: "⚠️ فشل في نسخ الرابط.",
    });
  };

  const openStoryModal = () => {
    if (totalAllocated < 100) {
      notify.warning("⚠️ الرجاء موازنة الـ 100 نقطة كاملة أولاً لتتمكن من إنشاء بطاقة قصة إنستغرام جميلة ومكتملة!");
      return;
    }
    setIsStoryModalOpen(true);
  };

  const sortedTopicsForCard = useMemo(() => {
    return topics.toSorted((a, b) => b.points - a.points);
  }, [topics]);

  const activeSubNames = useMemo(() => {
    const names: string[] = [];
    selectedSubFiles.forEach(subId => {
      for (const t of topics) {
        const s = t.subFiles.find(sf => sf.id === subId);
        if (s) names.push(s.name);
      }
    });
    return names;
  }, [selectedSubFiles, topics]);

  const selectedSubFilesData = useMemo(() => {
    const list: { id: string; name: string; topicName: string }[] = [];
    selectedSubFiles.forEach(subId => {
      for (const t of topics) {
        const s = t.subFiles.find(sf => sf.id === subId);
        if (s) {
          list.push({
            id: subId,
            name: s.name,
            topicName: getShortTopicName(t.id, t.name)
          });
        }
      }
    });
    return list;
  }, [selectedSubFiles, topics]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-sm transition-all duration-300">
        <div className="absolute top-0 start-0 w-32 h-32 bg-primary/5 rounded-full -ms-16 -mt-16 -z-10 opacity-60"></div>
        <div className="absolute bottom-0 end-0 w-48 h-48 bg-muted/20 rounded-full -me-24 -mb-24 -z-10 opacity-60"></div>

        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-lg text-xs font-bold mb-3">
            <GitFork className="w-4 h-4 text-primary" />
            نظام التخطيط المتكامل
          </div>
          <h2 className="text-lg md:text-2xl font-extrabold mb-2 text-foreground">أثر القرارات المتداخلة ومحدودية الموارد</h2>
          <p className="text-muted-foreground leading-relaxed text-xs md:text-sm">
            في مرحلة ما بعد التحرير، ليست الصعوبة في سرد الاحتياجات بل في فهم أن <span className="font-bold text-foreground">كل خيار تصنعه له متطلبات مسبقة وتبعات معقدة</span>.
            وزع <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">100 نقطة تركيز</span> على الملفات الكبرى، ثم حدد <span className="bg-muted text-foreground font-bold px-1.5 py-0.5 rounded">الملفات الفرعية الأكثر إلحاحاً</span> لترى كيف تتداخل القرارات والضغوطات السيادية والتنموية معاً.
          </p>
        </div>
      </div>

      {/* The live region stays mounted so screen readers announce the warning. */}
      <div role="status" className="empty:hidden">
        {showWarning && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2 motion-safe:animate-pulse">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <span>لقد استنفدت نقاطك المتاحة. لزيادة نقاط هذا الملف، يرجى تقليل نقاط ملف آخر أولاً.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <Card className="lg:col-span-7 bg-card text-card-foreground border-border border shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-border">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                1. حدد نقاط الاهتمام والتفاصيل
              </h3>
              <p className="text-xs text-muted-foreground mt-1">وزّع النقاط بحكمة واكتشف الملفات المتشعبة بداخلها</p>
            </div>

            <div
              className={`border rounded-xl px-4 py-3 text-center flex flex-col justify-center items-center min-w-[140px] transition-all ${remainingPoints === 0
                ? 'bg-primary/10 border-primary text-primary animate-pulse font-bold'
                : 'bg-muted border-border text-foreground'
                }`}
            >
              <span className="text-[10px] text-muted-foreground font-bold mb-1">النقاط المتبقية للموازنة</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-extrabold text-foreground">{remainingPoints}</span>
                <span className="text-xs font-semibold text-muted-foreground">/ 100</span>
              </div>
              <div className="w-full bg-border h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${totalAllocated}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {topics.map(topic => {
              const isExpanded = expandedTopics.has(topic.id);
              const percentage = topic.points;
              const sliderGradient = `linear-gradient(to left, ${themeColors.primary} ${percentage}%, hsl(var(--muted)) ${percentage}%)`;

              return (
                <div
                  key={topic.id}
                  className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 hover:bg-muted/30 transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-card w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-border p-2">
                        {TOPIC_ICONS[topic.id] && React.createElement(TOPIC_ICONS[topic.id], { className: "w-5 h-5 text-primary" })}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{topic.name}</h4>
                        <button
                          type="button"
                          onClick={() => toggleTopicDetails(topic.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`priorities-topic-${topic.id}-details`}
                          className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 mt-0.5"
                        >
                          <span>تخصيص الملفات الفرعية والترابط</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 self-start sm:self-auto shadow-sm">
                      <button aria-label="تقليل بمقدار 1 نقطة"
                        onClick={() => changePoints(topic.id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-muted hover:bg-accent text-foreground font-bold text-xs transition-colors"
                        title="تقليل بمقدار 1 نقطة"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-extrabold text-xs text-foreground">
                        {topic.points}%
                      </span>
                      <button aria-label="زيادة بمقدار 1 نقطة"
                        onClick={() => changePoints(topic.id, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-muted hover:bg-accent text-foreground font-bold text-xs transition-colors"
                        title="زيادة بمقدار 1 نقطة"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-muted-foreground font-medium">0%</span>
                    <div className="flex-grow relative flex items-center">
                      <input
                        type="range"
                        aria-label={`نسبة ${getShortTopicName(topic.id, topic.name)}`}
                        aria-valuetext={`${topic.points}%`}
                        min="0"
                        max="100"
                        step="1"
                        value={topic.points}
                        onChange={(e) => onSliderInput(topic.id, parseInt(e.target.value, 10))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        style={{ background: sliderGradient }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold">100%</span>
                  </div>

                  {isExpanded && (
                    <div id={`priorities-topic-${topic.id}-details`} className="mt-4 pt-4 border-t border-border/60 animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed bg-card p-3 rounded-xl border border-border shadow-sm">
                        <span className="font-bold text-foreground block mb-1">وصف الملف الوطني:</span>
                        {topic.desc}
                      </p>
                      <div className="mb-2">
                        <span className="text-[11px] font-extrabold text-foreground block mb-2">الملفات الفرعية الأكثر إلحاحاً (اختر ما تراه أولوية تخصصية):</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {topic.subFiles.map(sub => {
                            const isChecked = selectedSubFiles.has(sub.id);
                            return (
                              <label
                                key={sub.id}
                                className={`group relative flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${isChecked
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSubFile(sub.id, topic.id)}
                                  className="peer sr-only"
                                />
                                <div
                                  className={`w-4 h-4 shrink-0 rounded-sm border mt-0.5 flex items-center justify-center transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${isChecked
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-input bg-background group-hover:border-primary/50'
                                    }`}
                                >
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="flex-grow">
                                  <span className="text-xs font-bold text-foreground block group-hover:text-primary transition-colors">{sub.name}</span>
                                  <span className="text-[10px] text-muted-foreground leading-relaxed block mt-0.5">{sub.desc}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Button
              variant="outline"
              onClick={resetPoints}
              className="text-xs font-semibold"
            >
              <RotateCcw className="w-4 h-4 me-1.5" />
              إعادة تعيين كافة النقاط والخيارات
            </Button>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary" />
              الحد الأقصى للملفات الفرعية المحددة هو 5 لضمان التركيز
            </span>
          </div>
        </Card>

        <div className="lg:col-span-5 space-y-6">

          <Card className="bg-card text-card-foreground border-border border shadow-sm p-6">
            <div className="mb-4">
              <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                <GitFork className="w-5 h-5 text-primary" />
                2. خريطة الترابط والتعقيد الانتقالي
              </h3>
              <p className="text-xs text-muted-foreground mt-1">تتبع كيف تؤثر خياراتك الفرعية على الملفات السيادية والأمنية الأخرى</p>
            </div>

            <div className="mb-4 border-t border-border/60 pt-4">
              <p id="priorities-comparison-label" className="text-xs font-bold text-foreground block mb-2 font-sans">مقارنة بروفايلك الخاص مع:</p>
              <div role="group" aria-labelledby="priorities-comparison-label" className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-muted rounded-xl text-[10px] sm:text-xs font-medium border border-border">
                {Object.entries(COMPARISONS).map(([key, comp]) => {
                  const isActive = activeComparisonKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveComparisonKey(key)}
                      className={`py-2 px-1 rounded-md text-center transition-all ${isActive
                        ? 'bg-card text-foreground shadow-sm font-bold border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {comp.title.split(' ')[0] + ' ' + (comp.title.split(' ')[1] || '')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sr-only"><table>
              <caption>مقارنة نقاط موازنتك مع {COMPARISONS[activeComparisonKey]?.title}</caption>
              <thead>
                <tr>
                  <th scope="col">الملف</th>
                  <th scope="col">نقاط موازنتك الحالية</th>
                  <th scope="col">{COMPARISONS[activeComparisonKey]?.title}</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(row => (
                  <tr key={row.topic}>
                    <th scope="row">{row.topic}</th>
                    <td>{row.current}%</td>
                    <td>{row.comparison}%</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div aria-hidden="true" className="relative w-full h-[260px] flex items-center justify-center bg-muted/20 rounded-xl border border-border p-2 mb-4">
              <React.Suspense fallback={null}>
                <PrioritiesRadar
                  data={chartData}
                  comparisonTitle={COMPARISONS[activeComparisonKey]?.title || ''}
                  primary={themeColors.primary}
                  labelColor={labelColor}
                />
              </React.Suspense>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-start gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 p-2.5">
                {persona && TOPIC_ICONS[persona.id] ? (
                  React.createElement(TOPIC_ICONS[persona.id], { className: "w-full h-full text-primary" })
                ) : (
                  <span className="text-xl">🤔</span>
                )}
              </div>
              <div>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${persona ? persona.tagClass : 'text-muted-foreground bg-muted border-border'
                  }`}>
                  {persona ? persona.tag : 'بانتظار توزيع النقاط'}
                </span>
                <h4 className="font-bold text-foreground mt-1 text-sm">
                  {persona ? persona.title : 'لم تحدد أولوياتك الكبرى بعد'}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {persona ? persona.desc : 'قم بتوزيع نقاط الاهتمام الـ 100 بالكامل واختيار ملفاتك الفرعية للحصول على تصنيفك التوافقي الدقيق ومقارنته بالاستطلاعات الوطنية.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/50 rounded-xl border border-border mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground">مقياس تداخل وتعقيد رؤيتك:</span>
                <span className={`text-xs font-bold ${interdependencyInfo.labelClass}`}>{interdependencyInfo.label}</span>
              </div>
              <div className="w-full bg-border h-2.5 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${interdependencyInfo.complexity}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                {interdependencyInfo.explanation}
              </p>
            </div>

            <div className="space-y-3">
              {interdependencyInfo.alerts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs italic">
                  قم باختيار "الملفات الفرعية الأكثر إلحاحاً" داخل المحاور على اليمين لتفعيل خريطة الترابط وفك التشابك السوري.
                </div>
              ) : (
                interdependencyInfo.alerts.map((alert, i) => (
                  <div key={i} className="p-3 bg-card border border-border rounded-xl hover:border-primary/50 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        {TOPIC_ICONS[alert.parentId] && React.createElement(TOPIC_ICONS[alert.parentId], { className: "w-3.5 h-3.5 text-primary me-1" })}
                        {alert.subName}
                      </span>
                      <span className="text-[9px] bg-muted text-muted-foreground font-extrabold px-2 py-0.5 rounded-full border border-border">
                        {alert.parentName}
                      </span>
                    </div>

                    {alert.warningText && (
                      <div className={`mt-2.5 p-2.5 rounded-lg text-[10px] sm:text-xs leading-relaxed border ${alert.isFulfilled
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}>
                        <span className="font-bold flex items-center gap-1 mb-1">
                          {alert.isFulfilled ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          {alert.isFulfilled ? 'تكامل مثالي واستيفاء العلاقة:' : 'عقبة وعلاقة حرجة غير مستوفاة:'}
                        </span>
                        {alert.isFulfilled ? 'خيارك منسجم ومدروس، المتطلبات المتبادلة للتطبيق جاهزة تقنياً وأمنياً.' : alert.warningText}

                        {!alert.isFulfilled && alert.unsatisfiedNames.length > 0 && (
                          <div className="mt-1.5 flex gap-1 items-center flex-wrap">
                            <span className="text-[9px] font-bold text-muted-foreground">يتطلب تفعيل:</span>
                            {alert.unsatisfiedNames.map((name, idx) => (
                              <span key={idx} className="bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border/60 pt-5 mt-5">
              <div className="mb-4">
                <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-primary" />
                  3. تصدير البطاقة ومشاركة الرؤية
                </h3>
                <p className="text-xs text-muted-foreground mt-1">انشر بروفايلك الفريد بصورة مخصصة كستوري إنستغرام أو انسخ الرابط</p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={openStoryModal}
                  className="w-full text-primary-foreground font-bold text-sm py-6 bg-primary hover:bg-primary/95 transition-all shadow-md shadow-primary/10"
                >
                  <Instagram className="w-5 h-5 me-2" />
                  تصميم وتنزيل صورة لـ ستوري إنستغرام / سناب
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleCopyText}
                    variant="secondary"
                    className="w-full font-bold text-xs py-5"
                  >
                    <Copy className="w-4 h-4 me-1.5" />
                    نسخ ملخص الأولويات للنشر
                  </Button>

                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="w-full font-bold text-xs py-5"
                  >
                    <LinkIcon className="w-4 h-4 me-1.5" />
                    نسخ رابط البروفايل الذكي
                  </Button>
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>

      <ShareImageDialog
        open={isStoryModalOpen}
        onOpenChange={setIsStoryModalOpen}
        title="مشاركة بطاقة الأولويات"
        description="معاينة بطاقة أولوياتك الوطنية بصيغة قصة أو منشور."
        filename={`syrian-priorities-${Date.now()}.png`}
        shareTitle={persona?.title ?? 'أولوياتي لمستقبل سوريا'}
        allowFormatToggle
        defaultFormat="story"
        renderCard={({ themeId, format, cardRef }) => {
          const isStory = format === 'story';
          const RADAR_ORDER = ['economy', 'justice', 'housing', 'security', 'politics', 'digital'];
          const SIZE = isStory ? 96 : 92;
          const cx = SIZE / 2;
          const cy = SIZE / 2;
          const R = isStory ? 38 : 36;
          const n = RADAR_ORDER.length;
          const pointsMap: Record<string, number> = {};
          topics.forEach((t) => { pointsMap[t.id] = t.points; });
          const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
          const rings = [0.33, 0.66, 1.0];
          const ringPath = (ratio: number) =>
            RADAR_ORDER.map((_, i) => {
              const a = angle(i);
              const r = R * ratio;
              return `${i === 0 ? 'M' : 'L'} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
            }).join(' ') + ' Z';
          const dataPath =
            RADAR_ORDER.map((id, i) => {
              const ratio = (pointsMap[id] ?? 0) / 100;
              const a = angle(i);
              const r = R * ratio;
              return `${i === 0 ? 'M' : 'L'} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
            }).join(' ') + ' Z';

          const topPriorities = sortedTopicsForCard.slice(0, 3);

          return (
            <BrandShareFrame
              ref={cardRef}
              id="story-card-canvas"
              themeId={themeId}
              moduleLabel="موازنة الأولويات"
              shareUrl="syrian.zone/priorities"
              format={format}
            >
              {(tokens) => {
                const gridColor = tokens.isDark ? 'rgba(238,240,255,0.18)' : 'rgba(23,26,46,0.14)';
                const trackBg = tokens.isDark ? 'rgba(238,240,255,0.14)' : 'rgba(23,26,46,0.09)';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 22 : 16 }}>
                    {/* 1. Hero: Radar + Persona title */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: isStory ? 'column' : 'row',
                        alignItems: 'center',
                        gap: isStory ? 10 : 14,
                        textAlign: isStory ? 'center' : 'right',
                      }}
                    >
                      <div dir="ltr" style={{ flexShrink: 0 }}>
                        <svg
                          width={SIZE}
                          height={SIZE}
                          viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`}
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ display: 'block', overflow: 'visible' }}
                        >
                          {rings.map((ratio, ri) => (
                            <path
                              key={ri}
                              d={ringPath(ratio)}
                              fill="none"
                              stroke={gridColor}
                              strokeWidth={ratio === 1.0 ? 1.1 : 0.6}
                            />
                          ))}
                          {RADAR_ORDER.map((_, i) => {
                            const a = angle(i);
                            return (
                              <line
                                key={i}
                                x1={cx}
                                y1={cy}
                                x2={cx + R * Math.cos(a)}
                                y2={cy + R * Math.sin(a)}
                                stroke={gridColor}
                                strokeWidth={0.6}
                              />
                            );
                          })}
                          <path
                            d={dataPath}
                            fill={tokens.primary}
                            fillOpacity={0.22}
                            stroke={tokens.primary}
                            strokeWidth={2}
                            strokeLinejoin="round"
                          />
                          {RADAR_ORDER.map((id, i) => {
                            const ratio = (pointsMap[id] ?? 0) / 100;
                            const a = angle(i);
                            return (
                              <circle
                                key={id}
                                cx={cx + R * ratio * Math.cos(a)}
                                cy={cy + R * ratio * Math.sin(a)}
                                r={2.5}
                                fill={tokens.node}
                              />
                            );
                          })}
                        </svg>
                      </div>

                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: MADAR_DISPLAY_FONT,
                            fontSize: isStory ? 26 : 24,
                            fontWeight: 900,
                            lineHeight: 1.2,
                            color: tokens.ink,
                          }}
                        >
                          {persona?.title ?? 'أولوياتي لمستقبل سوريا'}
                        </div>
                        {persona?.desc && (
                          <p
                            style={{
                              fontSize: 12.5,
                              lineHeight: 1.5,
                              margin: '6px 0 0',
                              color: tokens.muted,
                            }}
                          >
                            {persona.desc}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 2. Top 3 priorities */}
                    <div
                      style={{
                        borderRadius: 14,
                        backgroundColor: tokens.card,
                        border: `1px solid ${tokens.border}`,
                        padding: isStory ? '16px 16px' : '14px 16px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: tokens.muted,
                          marginBottom: 12,
                        }}
                      >
                        أعلى الأولويات
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 14 : 12 }}>
                        {topPriorities.map((topic) => (
                          <div key={topic.id}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                marginBottom: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 800,
                                  color: tokens.ink,
                                  lineHeight: 1.3,
                                }}
                              >
                                {topic.name}
                              </span>
                              <span
                                dir="ltr"
                                style={{
                                  fontFamily: MADAR_MONO_FONT,
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: tokens.primary,
                                  flexShrink: 0,
                                }}
                              >
                                {topic.points}%
                              </span>
                            </div>
                            <div
                              style={{
                                width: '100%',
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: trackBg,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${topic.points}%`,
                                  borderRadius: 999,
                                  backgroundColor: tokens.primary,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }}
            </BrandShareFrame>
          );
        }}
      />
    </div>
  );
}
