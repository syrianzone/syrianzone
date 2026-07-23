import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LevelBadge } from './LevelBadge';

// mirrors GuideLevelService::LEVELS; the API threshold test keeps the two in sync
const LEVELS: { level: number; points: number; perk: string }[] = [
  { level: 1, points: 0, perk: 'رقم المستوى' },
  { level: 2, points: 15, perk: 'رقم المستوى' },
  { level: 3, points: 75, perk: 'شارة مرشد محلي' },
  { level: 4, points: 250, perk: 'نجمة برقم المستوى' },
  { level: 5, points: 500, perk: 'نجمة برقم المستوى' },
  { level: 6, points: 1500, perk: 'شارة ذهبية' },
  { level: 7, points: 5000, perk: 'شارة ذهبية' },
  { level: 8, points: 15000, perk: 'شارة وردية مميزة' },
  { level: 9, points: 50000, perk: 'شارة وردية مميزة' },
  { level: 10, points: 100000, perk: 'شارة وردية مميزة' },
];

const POINT_RULES = [
  'مكان مقبول: 15 نقطة',
  'كل صورة على مكان مقبول: 5 نقاط',
  'وصف وافٍ (200 حرف أو أكثر): 5 نقاط إضافية',
  'كل حفظ يحصل عليه مكانك: نقطة واحدة',
];

export function MilestonesSheet(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="bottom" dir="rtl" className="max-h-[80dvh] overflow-y-auto">
        <SheetHeader className="text-right sm:text-right">
          <SheetTitle>مستويات المرشد المحلي</SheetTitle>
          <SheetDescription>اجمع النقاط بمساهماتك في مشوار وارتقِ في المستويات.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-foreground">كيف تُحسب النقاط؟</h4>
            <ul className="list-disc space-y-1 pr-5 text-sm text-muted-foreground">
              {POINT_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="mb-2 text-sm font-semibold text-foreground">المستويات</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted-foreground">
                  <th className="py-1.5 pl-2 font-medium">المستوى</th>
                  <th className="py-1.5 pl-2 font-medium">النقاط المطلوبة</th>
                  <th className="py-1.5 font-medium">الميزة</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l) => (
                  <tr key={l.level} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pl-2">
                      <span className="flex items-center gap-1.5">
                        <LevelBadge level={l.level} />
                        <span dir="ltr" className="tabular-nums text-foreground">{l.level}</span>
                      </span>
                    </td>
                    <td className="py-1.5 pl-2">
                      <span dir="ltr" className="tabular-nums text-foreground">{l.points}</span>
                    </td>
                    <td className="py-1.5 text-muted-foreground">{l.perk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
