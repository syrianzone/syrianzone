import type { Axis, AxisId } from '../data/types';

/**
 * Visual orientation of each numeric axis (purely presentational — scoring and
 * question effects are untouched). `true` mirrors the bar so the axis's `right`
 * pole is drawn on the physical LEFT and its `left` pole on the physical right.
 *
 * Approved reading (يمين/يسار as the user sees them):
 *   auth_lib         سلطوية يمين · حرية مدنية يسار
 *   rel_sec          دين الدولة يمين · علمانية يسار
 *   soc_cap          سوق حر يمين · اشتراكي يسار        (no mirror)
 *   nat_glob         وطني يمين · عالمي يسار
 *   mil_pac          عسكري يمين · سلمي يسار
 *   ret_rec          محاسبة يمين · مصالحة يسار
 *   central_federal  مركزي يمين · لامركزي يسار
 *   identity_civic   هوية أحادية يمين · مواطنة تعدّدية يسار
 *   ris_communal     أمن مركزي يمين · أمن محلي يسار
 *   women_rights     تقليدي يمين · حقوق نسوية يسار
 *   sect_memory      محاسبة يمين · تجاوز الماضي يسار    (no mirror)
 */
export const AXIS_MIRRORED: Record<AxisId, boolean> = {
  auth_lib: true,
  rel_sec: true,
  soc_cap: false,
  nat_glob: true,
  mil_pac: true,
  ret_rec: true,
  central_federal: true,
  identity_civic: true,
  ris_communal: true,
  women_rights: true,
  sect_memory: false,
};

export interface AxisDisplay {
  /** Label shown at the physical right end of the bar. */
  rightLabel: string;
  /** Label shown at the physical left end of the bar. */
  leftLabel: string;
  /** True when a positive value leans toward the physical left. */
  positiveOnLeft: boolean;
}

export function axisDisplay(axis: Axis): AxisDisplay {
  const mirrored = AXIS_MIRRORED[axis.id];
  return {
    rightLabel: mirrored ? axis.left : axis.right,
    leftLabel: mirrored ? axis.right : axis.left,
    positiveOnLeft: mirrored,
  };
}

/** Physical horizontal position (0 = left … 100 = right) of a value marker. */
export function axisMarkerLeft(value: number, positiveOnLeft: boolean): number {
  const magnitude = Math.min(Math.abs(value), 1) * 50;
  const leansLeft = value >= 0 === positiveOnLeft;
  return leansLeft ? 50 - magnitude : 50 + magnitude;
}
