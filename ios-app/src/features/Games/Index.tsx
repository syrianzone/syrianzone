import { ScrollView, View } from 'react-native';
import registry from '../../../../resources/data/games.json';
import { SvgXml } from 'react-native-svg';
import { artwork } from '../../ui/original-artwork.generated';
import { Heading, Label, Row, Section, contentStyle } from '../../components';
import { ProjectIcon } from '../../ui/graphics';
import { useFeatureNavigation } from '../../platform/features';
import { openExternal } from '../../platform/links';
import { useTheme } from '../../ui/theme';
import { useState } from 'react';
export function GamesScreen(): React.JSX.Element {
  const navigation = useFeatureNavigation();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle}><ProjectIcon name="games" size={48} /><Heading>الألعاب</Heading>{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
    {registry.map(game => <View key={game.slug} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {game.slug === 'president' ? <SvgXml xml={artwork.president!} width={42} height={42} /> : <ProjectIcon name={game.slug === '2048' ? 'game_2048' : game.slug === 'solitare' ? 'solitaire' : game.slug} size={42} />}
      <View style={{ flex: 1 }}>{'comingSoon' in game && game.comingSoon ? <Section><Label>{game.title}</Label><Label secondary>قريباً</Label></Section> : <Row title={game.title} subtitle={'external' in game && game.external ? 'موقع خارجي' : 'تلعب على جهازك'} onPress={() => {
        if ('external' in game && game.external && 'href' in game) void openExternal(game.href).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح اللعبة.'));
        else navigation.open(game.slug, {});
      }} />}</View>
    </View>)}
  </ScrollView>;
}
// PORT STATUS: source resources/js/Pages/Games/Index.tsx and resources/js/Domain/games/GameTile.tsx; confidence high; todos 0.
