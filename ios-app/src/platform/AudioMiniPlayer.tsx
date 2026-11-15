import { useFeatureNavigation } from './features';
import { QuranMiniPlayer, QuranMiniPlayerButton, QuranMiniPlayerSheet } from './quran/components';
export function AudioMiniPlayer({ hidden = false }: { hidden?: boolean }): React.JSX.Element {
  const navigation = useFeatureNavigation();
  return <QuranMiniPlayer hidden={hidden} onOpen={() => navigation.open('muslim_radio')} />;
}

export function AudioMiniPlayerButton(props: { onPress(): void; compact?: boolean }): React.JSX.Element {
  return <QuranMiniPlayerButton {...props} accessory />;
}
export function AudioMiniPlayerSheet(props: { visible: boolean; onClose(): void }): React.JSX.Element {
  const navigation = useFeatureNavigation();
  return <QuranMiniPlayerSheet {...props} onOpen={() => navigation.open('muslim_radio')} />;
}

// PORT STATUS: source resources/js/Domain/quran/RadioMiniPlayer.tsx; confidence medium; todos 1 native bottom safe-area placement verification.
