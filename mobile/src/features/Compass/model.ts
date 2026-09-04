import { SCALES, type Question, type Scale } from './data';

export type CompassAnswers = Readonly<Record<number, number>>;
export type CompassResults = Readonly<Record<string, number>>;

export function calculateCompassResults(
  questions: readonly Question[],
  answers: CompassAnswers,
): CompassResults {
  const results: Record<string, number> = {};
  const totals: Record<string, number> = {};
  for (const scale of SCALES) {
    results[scale.id] = 0;
    totals[scale.id] = 0;
  }

  questions.forEach((question, index) => {
    const answer = answers[index];
    if (answer === undefined) {
      return;
    }
    results[question.category] =
      (results[question.category] ?? 0) + answer * question.effect;
    totals[question.category] = (totals[question.category] ?? 0) + 1;
  });

  for (const scale of SCALES) {
    const count = totals[scale.id] ?? 0;
    if (count > 0) {
      results[scale.id] = (results[scale.id] ?? 0) / (count * 2);
    }
  }
  return results;
}

export function compassPercentage(value: number): number {
  return Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
}

// The gauge marker is placed with a physical `left` offset while the pole
// labels flow with the writing direction, so an RTL row (left pole rendered on
// the right) needs the mirrored offset to land under its own label.
export function gaugeMarkerPercent(
  value: number,
  direction: 'ltr' | 'rtl',
): number {
  const percentage = compassPercentage(value);
  return direction === 'rtl' ? percentage : 100 - percentage;
}

export function compassRating(value: number, scale: Scale): string {
  const percentage = ((value + 1) / 2) * 100;
  if (percentage <= 10) {
    return `${scale.right} جداً`;
  }
  if (percentage <= 30) {
    return scale.right;
  }
  if (percentage <= 45) {
    return `يميل إلى ${scale.right}`;
  }
  if (percentage <= 55) {
    return 'محايد';
  }
  if (percentage <= 70) {
    return `يميل إلى ${scale.left}`;
  }
  if (percentage <= 90) {
    return scale.left;
  }
  return `${scale.left} جداً`;
}

export function shuffleQuestions(
  questions: readonly Question[],
  random = Math.random,
): Question[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled;
}
