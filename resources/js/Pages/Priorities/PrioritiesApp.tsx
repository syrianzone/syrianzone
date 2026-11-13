import React, { useState, useEffect, useRef, useMemo } from 'react';
import { notify } from '@/Lib/notify';
import { copyText } from '@/Lib/copy';
import type { PngDeclarations } from '@/Lib/exportElementAsPng';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  RotateCcw,
  Share2,
  Download,
  Copy,
  Link as LinkIcon,
  SlidersHorizontal,
  AlertTriangle,
  GitFork,
  UserCheck,
  Sparkles,
  X,
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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/Components/ui/card";
import { THEME_REGISTRY, getThemeById, hexToRgbString, shareCardPalette, useThemeId } from '@/Lib/theme';
import { Button } from "@/Components/ui/button";

import {
  INITIAL_TOPICS,
  COMPARISONS,
  DEPENDENCIES,
  Topic,
  SubFile
} from './data';

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

const getStoryThemeStyles = (themeKey: string) => {
  const theme = getThemeById(themeKey) || getThemeById('dark') || THEME_REGISTRY[2];
  const priorities = theme.priorities || {
    gradient: 'linear-gradient(135deg, #0b0f19 0%, #064e3b 50%, #022c22 100%)',
    accentBg: 'bg-emerald-500/20 border-emerald-500/30',
    accentText: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    headerSubtitle: '#a7f3d0',
    urlText: '#34d399',
  };

  // The card's gradient comes from the palette, not from the scheme: jasmine is
  // a light theme with a deliberately dark card gradient, so only `light` draws
  // the dark-on-light text set.
  const palette = shareCardPalette(theme.id);
  const isLight = palette.isLight;
  const textPrimary = palette.textPrimary;
  const textSecondary = palette.textSecondary;
  const textMuted = palette.textMuted;
  const cardBg = palette.cardBg;
  const cardBorder = palette.cardBorder;

  const headerTitle = palette.textPrimary;
  const headerSubtitle = priorities.headerSubtitle;
  const urlLabel = isLight ? '#64748b' : '#cbd5e1';
  const urlText = priorities.urlText;

  return {
    gradient: priorities.gradient,
    accentBg: priorities.accentBg,
    accentText: priorities.accentText,
    badgeBg: priorities.badgeBg,
    primary: theme.primary,
    primaryRgb: hexToRgbString(theme.primary),
    textPrimary,
    textSecondary,
    textMuted,
    cardBg,
    cardBorder,
    isLight,
    headerTitle,
    headerSubtitle,
    urlLabel,
    urlText
  };
};

const BUDGET_LIMIT = 100;
const MAX_SUBFILES_CHECKED = 5;

/** The story card draws its own fixed palette, so the exporter's generic slate
 *  fallback would flatten it; this is the card's own modern-colour mapping. */
const STORY_CARD_PNG_OPTIONS = {
  scale: 3,
  backgroundColor: null,
  removeSelectors: ['.story-card-bg-blur'],
  rootStyle: { color: '#ffffff', 'border-color': 'transparent' },
  colorPolicy: (node: HTMLElement, style: CSSStyleDeclaration): PngDeclarations => {
    const className = typeof node.className === 'string' ? node.className : '';
    const modern = (value: string | undefined): value is string =>
      !!value && (value.includes('oklch') || value.includes('oklab') || value.includes('color-mix'));
    const declarations: PngDeclarations = {};

    if (modern(style.backgroundColor)) {
      if (className.includes('bg-emerald-500/20')) declarations['background-color'] = 'rgba(16, 185, 129, 0.2)';
      else if (className.includes('bg-slate-900/60')) declarations['background-color'] = 'rgba(15, 23, 42, 0.6)';
      else if (className.includes('bg-emerald-500/10')) declarations['background-color'] = 'rgba(16, 185, 129, 0.1)';
      else if (className.includes('bg-slate-900/50')) declarations['background-color'] = 'rgba(15, 23, 42, 0.5)';
      else if (className.includes('bg-slate-950/60')) declarations['background-color'] = 'rgba(2, 6, 23, 0.6)';
      else if (className.includes('bg-emerald-400')) declarations['background-color'] = '#34d399';
      else if (className.includes('bg-emerald-600')) declarations['background-color'] = '#059669';
      else declarations['background-color'] = cleanStoryColor(style.backgroundColor);
    }

    if (modern(style.backgroundImage)) {
      declarations['background-image'] = 'none';
      declarations['background-color'] = '#10b981'; // solid fallback for the gradient progress bars
    }

    if (modern(style.background)) {
      declarations.background = 'none';
      declarations['background-color'] = '#022c22';
    }

    if (modern(style.color)) {
      if (className.includes('text-emerald-400')) declarations.color = '#34d399';
      else if (className.includes('text-emerald-300')) declarations.color = '#6ee7b7';
      else if (className.includes('text-amber-400')) declarations.color = '#fbbf24';
      else declarations.color = cleanStoryColor(style.color);
    }

    if (modern(style.borderColor)) {
      if (className.includes('border-emerald-500/30')) declarations['border-color'] = 'rgba(16, 185, 129, 0.3)';
      else if (className.includes('border-slate-700')) declarations['border-color'] = '#334155';
      else if (className.includes('border-emerald-500/20')) declarations['border-color'] = 'rgba(16, 185, 129, 0.2)';
      else if (className.includes('border-slate-800/60')) declarations['border-color'] = 'rgba(30, 41, 59, 0.6)';
      else if (className.includes('border-slate-800/80')) declarations['border-color'] = 'rgba(30, 41, 59, 0.8)';
      else declarations['border-color'] = cleanStoryColor(style.borderColor);
    }

    return declarations;
  },
};

/** html2canvas cannot parse oklch/oklab/color-mix; map the card palette to hex. */
function cleanStoryColor(color: string): string {
  if (!color) return color;
  if (!color.includes('oklch') && !color.includes('oklab') && !color.includes('color-mix')) return color;

  if (color.includes('transparent')) {
    if (color.includes('emerald') || color.includes('16, 185, 129') || color.includes('52, 211, 153')) return 'rgba(16, 185, 129, 0.15)';
    if (color.includes('red') || color.includes('220, 38, 38')) return 'rgba(220, 38, 38, 0.05)';
    return 'rgba(15, 23, 42, 0.5)';
  }

  if (color.includes('emerald-400') || color.includes('34d399') || color.includes('52, 211, 153')) return '#34d399';
  if (color.includes('emerald-500') || color.includes('10b981') || color.includes('16, 185, 129')) return '#10b981';
  if (color.includes('emerald-600') || color.includes('059669') || color.includes('5, 150, 105')) return '#059669';
  if (color.includes('emerald-300') || color.includes('6ee7b7') || color.includes('110, 231, 183')) return '#6ee7b7';
  if (color.includes('amber') || color.includes('fbbf24') || color.includes('251, 191, 36')) return '#fbbf24';
  if (color.includes('red') || color.includes('dc2626') || color.includes('220, 38, 38')) return '#dc2626';
  if (color.includes('slate-400') || color.includes('94a3b8') || color.includes('148, 163, 184')) return '#94a3b8';
  if (color.includes('slate-700') || color.includes('334155') || color.includes('51, 65, 85')) return '#334155';
  if (color.includes('slate-800') || color.includes('1e293b') || color.includes('30, 41, 59')) return '#1e293b';
  if (color.includes('slate-900') || color.includes('0f172a') || color.includes('15, 23, 42')) return '#0f172a';
  if (color.includes('slate-950') || color.includes('020617') || color.includes('2, 6, 23')) return '#020617';
  return '#34d399';
}

export default function PrioritiesApp() {
  const [topics, setTopics] = useState<Topic[]>(INITIAL_TOPICS.map(t => ({ ...t })));
  const [selectedSubFiles, setSelectedSubFiles] = useState<Set<string>>(new Set());
  const [activeComparisonKey, setActiveComparisonKey] = useState<string>('average');
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const activeTheme = useThemeId();
  const [isStoryModalOpen, setIsStoryModalOpen] = useState<boolean>(false);
  const [storyTheme, setStoryTheme] = useState<string>(activeTheme);
  const storyThemeStyles = getStoryThemeStyles(storyTheme);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(['economy', 'justice', 'housing', 'security', 'politics', 'digital']));

  const [showWarning, setShowWarning] = useState<boolean>(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const storyCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bannerDismissed = localStorage.getItem('sz-priorities-banner-dismissed');
    if (bannerDismissed === 'true') {
      setShowBanner(false);
    }

    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get('state');
    if (stateParam) {
      try {
        const decoded = decodeURIComponent(escape(atob(stateParam)));
        const [pointsStr, subsStr] = decoded.split('|');
        if (pointsStr) {
          const pointsMap = pointsStr.split(',').reduce((acc, item) => {
            const [id, val] = item.split(':');
            if (id && val) acc[id] = parseInt(val, 10);
            return acc;
          }, {} as Record<string, number>);

          setTopics(prev => prev.map(t => ({
            ...t,
            points: pointsMap[t.id] !== undefined ? pointsMap[t.id] : t.points
          })));
        }
        if (subsStr) {
          const subsArray = subsStr.split(',').filter(Boolean);
          setSelectedSubFiles(new Set(subsArray));
        }
      } catch (e) {
        console.error('Failed to parse URL state', e);
      }
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
    localStorage.setItem('sz-priorities-banner-dismissed', 'true');
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

    const sorted = [...topics].sort((a, b) => b.points - a.points);
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

    const sortedTopics = [...topics].sort((a, b) => b.points - a.points);
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

    const statePoints = topics.map(t => `${t.id}:${t.points}`).join(',');
    const stateSubs = Array.from(selectedSubFiles).join(',');
    const encoded = btoa(unescape(encodeURIComponent(`${statePoints}|${stateSubs}`)));
    const shareUrl = `${window.location.origin}${window.location.pathname}?state=${encoded}`;

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
    setStoryTheme(activeTheme);
    setIsStoryModalOpen(true);
  };

  const downloadStoryAsImage = async () => {
    const card = storyCardRef.current;
    if (!card) return;

    notify.success("⏳ يجري الآن تجميع وتوليد بطاقتك التخطيطية بجودة عالية الاستثنائية... الرجاء الانتظار.");

    try {
      // Imported on demand: html2canvas is heavy and only this button needs it.
      const { exportElementAsPng } = await import('@/Lib/exportElementAsPng');
      await exportElementAsPng(card, `Syrian-Consensus-Story-${Date.now()}.png`, STORY_CARD_PNG_OPTIONS);
      notify.success("🎉 تم تحميل صورتك بنجاح! افتح قصتك في إنستغرام أو سناب شات وأضفها الآن لإشعال التوافق البنّاء.");
      setIsStoryModalOpen(false);
    } catch {
      notify.warning("⚠️ حدث خطأ ما أثناء معالجة الصورة. يرجى محاولة التنزيل مرة أخرى.");
    }
  };

  const sortedTopicsForCard = useMemo(() => {
    return [...topics].sort((a, b) => b.points - a.points);
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

      {showWarning && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>لقد استنفدت نقاطك المتاحة. لزيادة نقاط هذا الملف، يرجى تقليل نقاط ملف آخر أولاً.</span>
        </div>
      )}

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
                          onClick={() => toggleTopicDetails(topic.id)}
                          className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 mt-0.5"
                        >
                          <span>تخصيص الملفات الفرعية والترابط</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
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
                    <div className="mt-4 pt-4 border-t border-border/60 animate-in fade-in slide-in-from-top-1 duration-200">
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
              <label className="text-xs font-bold text-foreground block mb-2 font-sans">مقارنة بروفايلك الخاص مع:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-muted rounded-xl text-[10px] sm:text-xs font-medium border border-border">
                {Object.entries(COMPARISONS).map(([key, comp]) => {
                  const isActive = activeComparisonKey === key;
                  return (
                    <button
                      key={key}
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

            <div className="relative w-full h-[260px] flex items-center justify-center bg-muted/20 rounded-xl border border-border p-2 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                  <PolarGrid stroke="rgba(128, 128, 128, 0.15)" />
                  <PolarAngleAxis
                    dataKey="topic"
                    tick={{
                      fontSize: 10,
                      fontWeight: 'bold',
                      fontFamily: 'IBM Plex Sans Arabic',
                      fill: labelColor
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 45]}
                    tick={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    formatter={(value, name) => {
                      const label = name === 'current' ? 'نقاط موازنتك الحالية' : COMPARISONS[activeComparisonKey]?.title || '';
                      return [`%${String(value ?? '')}`, label];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => value === 'current' ? 'نقاط موازنتك الحالية' : COMPARISONS[activeComparisonKey]?.title || ''}
                  />
                  <Radar
                    name="current"
                    dataKey="current"
                    stroke={themeColors.primary}
                    strokeWidth={2.5}
                    fill={themeColors.primary}
                    fillOpacity={0.15}
                    dot={{ r: 4, fill: themeColors.primary, stroke: '#fff', strokeWidth: 1 }}
                  />
                  <Radar
                    name="comparison"
                    dataKey="comparison"
                    stroke="rgba(128, 128, 128, 0.6)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="rgba(128, 128, 128, 0.05)"
                    fillOpacity={1}
                    dot={{ r: 3, fill: 'rgba(128, 128, 128, 0.8)', stroke: '#fff', strokeWidth: 1 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
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
                  className="w-full text-white font-bold text-sm py-6 bg-primary hover:bg-primary/95 transition-all shadow-md shadow-primary/10"
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

      {isStoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <Card className="bg-card text-card-foreground border-border border shadow-2xl p-6 max-w-lg w-full flex flex-col items-center">

            <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-border">
              <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                تصدير بطاقة القصة (Instagram Story)
              </h3>
              <button
                onClick={() => setIsStoryModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full flex justify-center py-2 overflow-x-auto">

              <div
                ref={storyCardRef}
                id="story-card-canvas"
                dir="rtl"
                className="w-[360px] h-[640px] relative overflow-hidden text-right select-none rounded-2xl flex flex-col justify-between p-6 shadow-2xl"
                style={{
                  background: storyThemeStyles.gradient,
                  color: storyThemeStyles.textPrimary,
                  fontFamily: 'IBM Plex Sans Arabic, sans-serif'
                }}
              >
                <div
                  className="story-card-bg-blur absolute top-0 right-0 w-44 h-44 rounded-full blur-[60px] pointer-events-none"
                  style={{ backgroundColor: `rgba(${storyThemeStyles.primaryRgb}, 0.15)` }}
                ></div>
                <div
                  className="story-card-bg-blur absolute bottom-12 left-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
                  style={{ backgroundColor: `rgba(${storyThemeStyles.primaryRgb}, 0.05)` }}
                ></div>

                <div
                  className="flex items-center justify-between pt-2 pb-2 border-b"
                  style={{ borderBottomColor: storyThemeStyles.cardBorder }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        minWidth: '32px',
                        minHeight: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        border: '1px solid',
                        overflow: 'hidden',
                        backgroundColor: storyThemeStyles.isLight ? 'rgba(0, 0, 0, 0.05)' : `rgba(${storyThemeStyles.primaryRgb}, 0.2)`,
                        borderColor: storyThemeStyles.isLight ? 'rgba(0, 0, 0, 0.1)' : `rgba(${storyThemeStyles.primaryRgb}, 0.3)`
                      }}
                    >
                      <img src="/assets/ar.svg" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} alt="علم سوريا" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black" style={{ color: storyThemeStyles.headerTitle }}>المساحة السورية</h4>
                      <p className="text-[7.5px]" style={{ color: storyThemeStyles.headerSubtitle }}>بوصلة أولويات العمل بعد التحرير</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', direction: 'ltr' }}>
                    <div style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', borderRadius: '6px', backgroundColor: '#ffffff', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg style={{ width: '100%', height: '100%', display: 'block' }} viewBox="0 0 31 31" shapeRendering="crispEdges">
                        <path stroke="#000000" d="M1 1.5h7m2 0h1m3 0h1m2 0h4m2 0h7M1 2.5h1m5 0h1m1 0h1m1 0h3m1 0h4m1 0h1m2 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m6 0h2m1 0h1m2 0h2m1 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m2 0h1m3 0h3m2 0h3m1 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m1 0h5m1 0h1m2 0h3m2 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m2 0h1m2 0h2m4 0h2m2 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 8.5h3m1 0h2m1 0h4M1 9.5h1m1 0h1m1 0h1m1 0h1m3 0h3m1 0h2m1 0h1m6 0h1m2 0h1M1 10.5h1m2 0h1m1 0h1m2 0h4m2 0h2m1 0h2m1 0h3m2 0h1m2 0h1M4 11.5h2m1 0h1m2 0h2m2 0h1m3 0h2m3 0h3m1 0h3M1 12.5h1m1 0h1m2 0h1m1 0h2m1 0h2m3 0h1m1 0h1m2 0h1m2 0h2m2 0h1M2 13.5h2m1 0h3m4 0h2m3 0h2m1 0h4m2 0h1m1 0h2M1 14.5h6m1 0h4m2 0h1m1 0h2m4 0h2m2 0h1m2 0h1M3 15.5h1m3 0h1m1 0h1m1 0h2m2 0h3m1 0h1m2 0h1m3 0h1m1 0h2M1 16.5h3m2 0h1m1 0h1m1 0h2m2 0h2m1 0h8m1 0h1m1 0h1M1 17.5h3m3 0h3m1 0h2m2 0h2m1 0h1m2 0h1m1 0h2m1 0h1m1 0h2M2 18.5h3m1 0h1m1 0h2m3 0h1m1 0h2m1 0h2m1 0h3m2 0h2m1 0h1M1 19.5h1m3 0h4m1 0h1m1 0h1m1 0h1m6 0h2m1 0h2m2 0h2M2 20.5h3m3 0h2m3 0h1m2 0h1m1 0h1m2 0h6m1 0h1M1 21.5h1m1 0h1m3 0h1m1 0h1m1 0h1m5 0h2m1 0h6M9 22.5h1m1 0h1m1 0h2m1 0h2m2 0h2m3 0h1m1 0h3M1 23.5h7m3 0h2m2 0h3m1 0h3m1 0h1m1 0h2m1 0h2M1 24.5h1m5 0h1m5 0h3m1 0h3m1 0h1m3 0h2m1 0h2M1 25.5h1m1 0h3m1 0h1m1 0h1m5 0h4m2 0h5m2 0h1M1 26.5h1m1 0h3m1 0h1m2 0h1m2 0h1m1 0h2m1 0h1m2 0h1m3 0h1m1 0h1M1 27.5h1m1 0h3m1 0h1m1 0h1m1 0h2m2 0h1m4 0h1m1 0h1m1 0h3m2 0h1M1 28.5h1m5 0h1m2 0h1m2 0h1m4 0h6m1 0h1m2 0h1M1 29.5h7m1 0h2m2 0h1m1 0h1m2 0h1m1 0h2m3 0h2m1 0h2" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <span className="text-[7px] font-extrabold leading-tight" style={{ color: storyThemeStyles.urlLabel }}>صمّم بروفايلك:</span>
                      <span className="text-[8px] font-black" style={{ color: storyThemeStyles.urlText }}>syrian.zone/priorities</span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', margin: '8px 0', padding: '0 8px' }}>
                  {(() => {
                    const RADAR_ORDER = ['economy', 'justice', 'housing', 'security', 'politics', 'digital'];
                    const SIZE = 80;
                    const cx = SIZE / 2;
                    const cy = SIZE / 2;
                    const R = 30; // max radius - leaves 10px padding each side
                    const n = RADAR_ORDER.length;
                    const accentColor = storyThemeStyles.urlText;
                    const gridColor = storyThemeStyles.isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';

                    const pointsMap: Record<string, number> = {};
                    topics.forEach(t => { pointsMap[t.id] = t.points; });
                    const maxVal = 100;

                    // angle for each axis: start at top (-90°), go clockwise
                    const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

                    const rings = [0.25, 0.5, 0.75, 1.0];

                    const ringPath = (ratio: number) => {
                      return RADAR_ORDER.map((_, i) => {
                        const a = angle(i);
                        const r = R * ratio;
                        const x = cx + r * Math.cos(a);
                        const y = cy + r * Math.sin(a);
                        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                      }).join(' ') + ' Z';
                    };

                    const dataPath = RADAR_ORDER.map((id, i) => {
                      const val = pointsMap[id] ?? 0;
                      const ratio = val / maxVal;
                      const a = angle(i);
                      const r = R * ratio;
                      const x = cx + r * Math.cos(a);
                      const y = cy + r * Math.sin(a);
                      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                    }).join(' ') + ' Z';

                    return (
                      <div
                        dir="ltr"
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '6px' }}
                      >
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
                              strokeWidth={ratio === 1.0 ? 0.8 : 0.5}
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
                                strokeWidth={0.5}
                              />
                            );
                          })}
                          <path
                            d={dataPath}
                            fill={accentColor}
                            fillOpacity={0.25}
                            stroke={accentColor}
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                          />
                          {RADAR_ORDER.map((id, i) => {
                            const val = pointsMap[id] ?? 0;
                            const ratio = val / maxVal;
                            const a = angle(i);
                            return (
                              <circle
                                key={id}
                                cx={cx + R * ratio * Math.cos(a)}
                                cy={cy + R * ratio * Math.sin(a)}
                                r={1.8}
                                fill={accentColor}
                              />
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}

                  <div>
                    <span
                      className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border"
                      style={{
                        color: storyThemeStyles.urlText,
                        backgroundColor: storyThemeStyles.isLight ? 'rgba(0, 0, 0, 0.05)' : `rgba(${storyThemeStyles.primaryRgb}, 0.1)`,
                        borderColor: storyThemeStyles.isLight ? 'rgba(0, 0, 0, 0.1)' : `rgba(${storyThemeStyles.primaryRgb}, 0.2)`
                      }}
                    >
                      {persona?.tag}
                    </span>
                  </div>
                  <h2 className="text-sm font-black mt-1 leading-tight" style={{ color: storyThemeStyles.textPrimary }}>{persona?.title}</h2>
                  <p className="text-[8px] mt-1 leading-relaxed px-1" style={{ color: storyThemeStyles.textSecondary }}>{persona?.desc}</p>
                </div>

                <div
                  className="space-y-1 rounded-xl p-3 my-1 backdrop-blur-sm border"
                  style={{
                    backgroundColor: storyThemeStyles.cardBg,
                    borderColor: storyThemeStyles.cardBorder
                  }}
                >
                  <h3
                    className="text-[8.5px] font-extrabold pb-1 flex items-center gap-1.5 border-b"
                    style={{
                      color: storyThemeStyles.textSecondary,
                      borderBottomColor: storyThemeStyles.cardBorder
                    }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: storyThemeStyles.urlText }}></span>
                    توزيع موازنة نقاط الاهتمام المائة بالكامل (النسب الستة):
                  </h3>
                  <div className="space-y-1.5">
                    {sortedTopicsForCard.map(topic => {
                      const pct = topic.points;
                      return (
                        <div key={topic.id} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[7.5px] font-bold" style={{ color: storyThemeStyles.textPrimary }}>
                            <span className="truncate max-w-[210px]" style={{ display: 'inline-block', direction: 'rtl', textAlign: 'right' }}>
                              {TOPIC_ICONS[topic.id] && (
                                <span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '6px', width: '10px', height: '10px' }}>
                                  {React.createElement(TOPIC_ICONS[topic.id], {
                                    size: 10,
                                    style: { color: storyThemeStyles.urlText, display: 'block' }
                                  })}
                                </span>
                              )}
                              <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>{topic.name}</span>
                            </span>
                            <span style={{ color: storyThemeStyles.urlText }}>%{pct}</span>
                          </div>
                          <div
                            className="w-full h-1 rounded-full overflow-hidden border"
                            style={{
                              backgroundColor: storyThemeStyles.isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.4)',
                              borderColor: storyThemeStyles.cardBorder
                            }}
                          >
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: storyThemeStyles.urlText }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedSubFilesData.length > 0 && (
                  <div
                    className="rounded-xl p-2 my-0.5 border text-right"
                    style={{
                      backgroundColor: storyThemeStyles.isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.25)',
                      borderColor: storyThemeStyles.cardBorder,
                      direction: 'rtl'
                    }}
                  >
                    <h4
                      className="text-[7.5px] font-extrabold pb-0.5 mb-1 border-b"
                      style={{
                        color: storyThemeStyles.textSecondary,
                        borderBottomColor: storyThemeStyles.cardBorder
                      }}
                    >
                      الملفات الفرعية الأكثر إلحاحاً:
                    </h4>
                    <div className="space-y-1 max-h-[85px] overflow-hidden">
                      {selectedSubFilesData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[7px] leading-tight font-bold justify-start" style={{ direction: 'rtl' }}>
                          <span
                            className="inline-block px-1 rounded-sm text-[6px] font-black shrink-0"
                            style={{
                              backgroundColor: storyThemeStyles.isLight ? 'rgba(0, 0, 0, 0.05)' : `rgba(${storyThemeStyles.primaryRgb}, 0.2)`,
                              color: storyThemeStyles.urlText,
                              border: `1px solid rgba(${storyThemeStyles.primaryRgb}, 0.35)`
                            }}
                          >
                            {item.topicName}
                          </span>
                          <span style={{ color: storyThemeStyles.textPrimary }}>
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center pb-2">
                  <p className="text-[7.5px]" style={{ color: storyThemeStyles.textMuted }}>المساحة السورية - مشروع سوري مفتوح المصدر</p>
                </div>

              </div>

            </div>

            <div className="w-full mt-4 mb-2" dir="rtl">
              <label className="block text-xs font-bold text-muted-foreground text-right mb-2">
                اختر لون المظهر للبطاقة:
              </label>
              <div className="flex flex-wrap justify-start gap-2">
                {THEME_REGISTRY.filter(t => t.id !== 'system').map((theme) => {
                  const themeKey = theme.id;
                  const colors = {
                    primary: theme.primary,
                  };
                  const isActive = storyTheme === themeKey;
                  const themeMeta = {
                    ar: theme.shortNameAr || theme.nameAr,
                    emoji: theme.emoji
                  };

                  return (
                    <button
                      key={themeKey}
                      onClick={() => setStoryTheme(themeKey)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isActive
                        ? 'border-transparent text-white shadow-sm scale-105'
                        : 'bg-card text-muted-foreground border-border hover:bg-accent/50 hover:text-foreground'
                        }`}
                      style={{
                        backgroundColor: isActive ? colors.primary : undefined,
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.primary }}></span>
                      <span>{themeMeta.emoji} {themeMeta.ar}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mt-5">
              <Button
                onClick={() => setIsStoryModalOpen(false)}
                variant="outline"
                className="w-full py-3"
              >
                إلغاء وإغلاق
              </Button>
              <Button
                onClick={downloadStoryAsImage}
                className="w-full py-3 text-white font-bold transition-colors shadow-md border-none flex items-center justify-center gap-2"
                style={{
                  backgroundColor: storyThemeStyles.primary,
                }}
              >
                <Download className="w-4 h-4" />
                حفظ وتنزيل الصورة
              </Button>
            </div>

          </Card>
        </div>
      )}
    </div>
  );
}
