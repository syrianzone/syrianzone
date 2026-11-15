export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutMetrics {
  readonly width: number;
  readonly height: number;
  readonly horizontalSizeClass: 'compact' | 'regular';
  readonly hasHinge: boolean;
  readonly verticalBarEdge: 'none' | 'left' | 'right';
  readonly safeArea: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
  readonly reservedRegions: ReadonlyArray<Rect & { readonly kind: 'division' | 'occlusion' }>;
}

export interface AppLayout {
  readonly axis: 'single' | 'horizontal' | 'vertical';
  readonly primary: Rect;
  readonly secondary: Rect | null;
}

const positive = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0;
const area = (rect: Rect): number => rect.width * rect.height;
const usable = (rect: Rect): boolean => rect.width >= 220 && rect.height >= 220;

function subtract(rect: Rect, reservation: Rect): Rect[] {
  const x = Math.max(rect.x, reservation.x);
  const y = Math.max(rect.y, reservation.y);
  const right = Math.min(rect.x + rect.width, reservation.x + reservation.width);
  const bottom = Math.min(rect.y + rect.height, reservation.y + reservation.height);
  if (right <= x || bottom <= y) return [rect];
  return [
    { x: rect.x, y: rect.y, width: x - rect.x, height: rect.height },
    { x: right, y: rect.y, width: rect.x + rect.width - right, height: rect.height },
    { x: rect.x, y: rect.y, width: rect.width, height: y - rect.y },
    { x: rect.x, y: bottom, width: rect.width, height: rect.y + rect.height - bottom }
  ].filter(candidate => candidate.width > 0 && candidate.height > 0);
}

// Rectangles use the observer's coordinates. Its safe area is already zero where native bars inset the observing container.
export function deriveLayout(metrics: LayoutMetrics | null, width: number, height: number, allowSecondary = true): AppLayout {
  const nativeWidth = positive(metrics?.width ?? 0);
  const nativeHeight = positive(metrics?.height ?? 0);
  // Native and React layout events can arrive in either order during a fold. Use their shared safe extent until both agree.
  const availableWidth = nativeWidth && positive(width) ? Math.min(nativeWidth, positive(width)) : nativeWidth || positive(width);
  const availableHeight = nativeHeight && positive(height) ? Math.min(nativeHeight, positive(height)) : nativeHeight || positive(height);
  const insets = metrics?.safeArea;
  const x = Math.min(positive(insets?.left ?? 0), availableWidth);
  const y = Math.min(positive(insets?.top ?? 0), availableHeight);
  const content = {
    x, y,
    width: Math.max(0, availableWidth - x - positive(insets?.right ?? 0)),
    height: Math.max(0, availableHeight - y - positive(insets?.bottom ?? 0))
  };
  let candidates: Rect[] = [content];
  for (const reservation of metrics?.reservedRegions ?? []) {
    if (![reservation.x, reservation.y, reservation.width, reservation.height].every(Number.isFinite) || reservation.width <= 0 || reservation.height <= 0) continue;
    candidates = candidates.flatMap(rect => subtract(rect, reservation));
  }
  candidates.sort((a, b) => area(b) - area(a));
  const primary = candidates[0] ?? { x, y, width: 0, height: 0 };
  if (!allowSecondary) return { axis: 'single', primary, secondary: null };
  let pair: AppLayout | null = null;
  let pairArea = 0;
  for (const first of candidates.filter(usable)) {
    for (const second of candidates.filter(usable)) {
      const horizontal = first.y === second.y && first.height === second.height && first.x >= second.x + second.width;
      const vertical = first.x === second.x && first.width === second.width && second.y >= first.y + first.height;
      if ((!horizontal && !vertical) || area(first) + area(second) <= pairArea) continue;
      pair = { axis: horizontal ? 'horizontal' : 'vertical', primary: first, secondary: second };
      pairArea = area(first) + area(second);
    }
  }
  if (pair) return pair;
  if (primary.width < 760) return { axis: 'single', primary, secondary: null };
  const listWidth = Math.min(400, Math.max(320, primary.width * 0.34));
  const gap = 16;
  return {
    axis: 'horizontal',
    primary: { ...primary, x: primary.x + primary.width - listWidth, width: listWidth },
    secondary: { ...primary, width: primary.width - listWidth - gap }
  };
}
