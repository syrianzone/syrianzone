import { MoonStar, Sun } from 'lucide-react-native';

import { AppButton } from '@/components/ui/AppButton';
import { useAppTheme } from '@/contexts/ThemeContext';

import { useTransitTheme } from '../TransitThemeContext';

export function TransitHeader() {
  const { theme, toggleTheme } = useTransitTheme();
  const { theme: appTheme } = useAppTheme();
  const Icon = theme === 'jasmine' ? MoonStar : Sun;
  return (
    <AppButton
      icon={<Icon color={appTheme.palette.foreground} size={18} />}
      onPress={toggleTheme}
      variant="ghost"
    >
      {theme === 'jasmine' ? 'الورد الدمشقي' : 'الياسمين'}
    </AppButton>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/layout/Header.tsx (72 lines)
  confidence: high
  todos:      0
  notes:      A native control preserves the transit-specific heritage theme toggle.
*/
