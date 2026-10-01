import React from 'react';
import { BarChart3, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/Components/ui/dialog';
import HeaderButton from './HeaderButton';
import HeaderPortal from './HeaderPortal';

interface Props {
  /** What goes behind "الإحصائيات": the live scores and the win/loss record. */
  stats: React.ReactNode;
  /** What goes behind "خيارات": new game, card style, and the mode switch. */
  options: React.ReactNode;
}

// The header buttons both card tables share, dropped into `GameShell`'s header
// slot beside "القوانين". The scores and the options live in modals rather than
// on the page: the table has to fit the viewport, so the header keeps only what
// changes a turn (the contract line) and tucks the rest behind these. The
// content is passed in, since each game scores differently.
export default function GameMenu({ stats, options }: Props) {
  return (
    <HeaderPortal>
      <Dialog>
        <DialogTrigger asChild>
          <HeaderButton icon={BarChart3}>الإحصائيات</HeaderButton>
        </DialogTrigger>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>الإحصائيات</DialogTitle>
          </DialogHeader>
          {stats}
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <HeaderButton icon={Settings2}>خيارات</HeaderButton>
        </DialogTrigger>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>خيارات</DialogTitle>
          </DialogHeader>
          {options}
        </DialogContent>
      </Dialog>
    </HeaderPortal>
  );
}
