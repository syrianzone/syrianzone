import { Navigation } from 'lucide-react-native';
import { Platform } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { useAppTheme } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

export function DirectionsButton({
  coordinate,
  label,
}: {
  coordinate: [number, number];
  label: string;
}) {
  const { theme } = useAppTheme();
  const [longitude, latitude] = coordinate;
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  return (
    <AppButton
      icon={<Navigation color={theme.palette.primaryForeground} size={18} />}
      onPress={() => void openSafeExternalUrl(url)}
    >
      الاتجاهات
    </AppButton>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/DirectionsButton.tsx (32 lines)
  confidence: high
  todos:      0
  notes:      Safe platform map URLs replace browser navigation links.
*/
