import { Base64 } from 'js-base64';

import {
  DEPENDENCIES,
  INITIAL_TOPICS,
  type Topic,
} from './data';

export const PRIORITY_BUDGET = 100;
export const MAX_SELECTED_SUBFILES = 5;
export const MAX_SHARED_STATE_LENGTH = 2048;

export function cloneTopics(): Topic[] {
  return INITIAL_TOPICS.map((topic) => ({
    ...topic,
    subFiles: topic.subFiles.map((subFile) => ({ ...subFile })),
  }));
}

export function totalPoints(topics: readonly Topic[]): number {
  return topics.reduce((sum, topic) => sum + topic.points, 0);
}

export function setTopicPoints(
  topics: readonly Topic[],
  id: string,
  requested: number,
): Topic[] {
  const otherTotal = topics.reduce(
    (sum, topic) => sum + (topic.id === id ? 0 : topic.points),
    0,
  );
  const points = Math.max(
    0,
    Math.min(PRIORITY_BUDGET - otherTotal, Math.round(requested)),
  );
  return topics.map((topic) =>
    topic.id === id ? { ...topic, points } : topic,
  );
}

export function toggleSubFile(
  selected: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  if (next.size >= MAX_SELECTED_SUBFILES) {
    return selected;
  }
  next.add(id);
  return next;
}

export interface DependencyAlert {
  fulfilled: boolean;
  name: string;
  requiredNames: readonly string[];
  warning: string;
}

export interface DependencyAnalysis {
  alerts: readonly DependencyAlert[];
  complexity: number;
  label: string;
}

export function analyzeDependencies(
  topics: readonly Topic[],
  selected: ReadonlySet<string>,
): DependencyAnalysis {
  const names = new Map(
    topics.flatMap((topic) =>
      topic.subFiles.map((subFile) => [subFile.id, subFile.name] as const),
    ),
  );
  let complexity = selected.size === 0 ? 10 : 10 + selected.size * 18;
  const alerts: DependencyAlert[] = [];
  for (const id of selected) {
    const dependency = DEPENDENCIES[id];
    const missing = dependency?.requires.filter((required) => !selected.has(required)) ?? [];
    if (dependency) {
      complexity += 15;
    }
    alerts.push({
      fulfilled: missing.length === 0,
      name: names.get(id) ?? id,
      requiredNames: missing.map((required) => names.get(required) ?? required),
      warning: dependency?.warning ?? '',
    });
  }
  complexity = Math.min(100, complexity);
  const label =
    complexity >= 70
      ? 'شديد التعقيد والتشابك'
      : complexity >= 35
        ? 'توازن ديناميكي متوسط'
        : selected.size === 0
          ? 'بسيط جداً'
          : 'سهل ومبسط';
  return { alerts, complexity, label };
}

const personaTitles: Readonly<Record<string, string>> = {
  digital: 'مهندس الأنظمة الذكية وسرعة الخدمة',
  economy: 'مُحرك عجلة الحياة والاقتصاد الحر',
  housing: 'باني مرافق سوريا المستقبل ومأوى المهجرين',
  justice: 'حامي دولة القانون والمصالحة المجتمعية',
  politics: 'مخطط الحوكمة الرشيدة والمؤسسات والسيادة',
  security: 'مهندس الأمن وسلطة وهيبة القانون',
};

export function priorityPersona(topics: readonly Topic[]): string | null {
  if (totalPoints(topics) < PRIORITY_BUDGET) {
    return null;
  }
  const highest = [...topics].sort((a, b) => b.points - a.points)[0];
  return highest ? personaTitles[highest.id] ?? personaTitles.economy! : null;
}

export function encodePriorityState(
  topics: readonly Topic[],
  selected: ReadonlySet<string>,
): string {
  const points = topics.map((topic) => `${topic.id}:${topic.points}`).join(',');
  return Base64.encodeURI(`${points}|${[...selected].join(',')}`);
}

function selectedSubFileNames(
  topics: readonly Topic[],
  selected: ReadonlySet<string>,
): string[] {
  return topics.flatMap((topic) =>
    topic.subFiles
      .filter((subFile) => selected.has(subFile.id))
      .map((subFile) => subFile.name),
  );
}

export function buildPrioritySummary(
  topics: readonly Topic[],
  selected: ReadonlySet<string>,
  persona: string,
  complexityLabel: string,
): string | null {
  if (totalPoints(topics) !== PRIORITY_BUDGET) {
    return null;
  }
  const ranked = [...topics].sort((a, b) => b.points - a.points);
  const lines = [
    '🇸🇾 *بروفايل أولوياتي التوافقية لمستقبل سوريا ما بعد التحرير* 🇸🇾',
    `لقد قمت بموازنة الـ 100 نقطة اهتمام، وحصلت على بروفايل: *"${persona}"*`,
    '',
    '💡 *ترتيب الأولويات الثلاث الكبرى لدي:*',
    ...ranked.slice(0, 3).map(
      (topic, index) =>
        `${index + 1}. ${topic.emoji} ${topic.name}: %${topic.points}`,
    ),
  ];
  const selectedNames = selectedSubFileNames(topics, selected);
  if (selectedNames.length > 0) {
    lines.push(
      '',
      '🎯 *الملفات الفرعية الأكثر إلحاحاً في خطتي:*',
      ...selectedNames.map((name) => ` - ${name}`),
    );
  }
  lines.push(
    '',
    `📊 *مقياس تداخل وتعقيد رؤيتي التخطيطية:* ${complexityLabel}`,
    '',
    '🔗 قم بموازنة أولوياتك وفك شفرة تداخل الملفات السيادية والتنموية معنا!',
  );
  return lines.join('\n');
}

export function priorityShareUrl(
  topics: readonly Topic[],
  selected: ReadonlySet<string>,
): string {
  return `https://syrian.zone/priorities?state=${encodePriorityState(topics, selected)}`;
}

export interface RadarPoint {
  x: number;
  y: number;
}

export function radarPoints(
  values: readonly number[],
  center: number,
  radius: number,
  maximum: number,
): RadarPoint[] {
  if (
    values.length < 3 ||
    !Number.isFinite(center) ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    return [];
  }
  return values.map((rawValue, index) => {
    const value = Number.isFinite(rawValue)
      ? Math.max(0, Math.min(maximum, rawValue))
      : 0;
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    const distance = radius * (value / maximum);
    return {
      x: Math.round((center + Math.cos(angle) * distance) * 1000) / 1000,
      y: Math.round((center + Math.sin(angle) * distance) * 1000) / 1000,
    };
  });
}

export function decodePriorityState(value: string): {
  selected: ReadonlySet<string>;
  topics: Topic[];
} | null {
  const normalized = value.replaceAll(' ', '+');
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SHARED_STATE_LENGTH ||
    !/^[A-Za-z0-9+/_=-]+$/.test(normalized)
  ) {
    return null;
  }
  try {
    const parts = Base64.decode(normalized).split('|');
    if (parts.length !== 2) {
      return null;
    }
    const [pointsPart = '', selectedPart = ''] = parts;
    const validTopicIds = new Set(INITIAL_TOPICS.map((topic) => topic.id));
    const entries = pointsPart ? pointsPart.split(',') : [];
    const points = new Map<string, number>();
    for (const entry of entries) {
      const [id, raw, extra] = entry.split(':');
      if (
        extra !== undefined ||
        !id ||
        !validTopicIds.has(id) ||
        points.has(id) ||
        !raw ||
        !/^\d{1,3}$/.test(raw)
      ) {
        return null;
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > PRIORITY_BUDGET) {
        return null;
      }
      points.set(id, parsed);
    }
    const topics = cloneTopics().map((topic) => ({
      ...topic,
      points: points.get(topic.id) ?? topic.points,
    }));
    if (totalPoints(topics) > PRIORITY_BUDGET) {
      return null;
    }
    const validSubFiles = new Set(
      topics.flatMap((topic) => topic.subFiles.map((item) => item.id)),
    );
    const selectedIds = selectedPart ? selectedPart.split(',') : [];
    if (
      selectedIds.length > MAX_SELECTED_SUBFILES ||
      selectedIds.some((id) => !validSubFiles.has(id)) ||
      new Set(selectedIds).size !== selectedIds.length
    ) {
      return null;
    }
    const selected = new Set(selectedIds);
    return { selected, topics };
  } catch {
    return null;
  }
}
