import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Heading, Label, Section, contentStyle } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { openExternal } from '../../platform/links';
import { EditorSheet } from '../../platform/Sheet';
import { logos } from './logos';
import { rankBackground, shawarmaTiers, type ShawarmaSpot } from './model';

export function ShawarmaScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<ShawarmaSpot | null>(null), [error, setError] = useState<string | null>(null);
  const openAccount = (): void => {
    if (!selected) return;
    setError(null);
    void openExternal(selected.href).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح حساب المطعم.'));
  };
  return <><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle}>
    <Heading>{"@macdoos's Shawarma Tier List"}</Heading>
    {shawarmaTiers.map(tier => <Section key={tier.rank} style={{ padding: 0, overflow: 'hidden' }}><View style={{ flexDirection: 'row', direction: 'ltr' }}>
      <View style={{ width: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: rankBackground }}><Label style={{ color: tier.color, fontSize: 42, lineHeight: 52, fontWeight: '800' }}>{tier.rank}</Label></View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 14 }}>
        {tier.spots.map(spot => <Pressable key={spot.name} accessibilityRole="button" accessibilityLabel={`${spot.name}، الفئة ${tier.rank}`} onPress={() => { setSelected(spot); setError(null); }} style={({ pressed }) => ({ width: 100, alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
          <Image source={logos[spot.logo] ?? null} style={{ width: 96, height: 96, borderRadius: 16, borderWidth: 1, borderColor: colors.separator }} contentFit="cover" accessible={false} />
          <Label style={{ textAlign: 'center', writingDirection: 'ltr', fontWeight: '600' }}>{spot.name}</Label>
        </Pressable>)}
      </View>
    </View></Section>)}
  </ScrollView>{selected ? <EditorSheet visible title={selected.name} close={() => setSelected(null)}>
    <Image source={logos[selected.logo] ?? null} accessibilityLabel={selected.name} style={{ width: 180, height: 180, borderRadius: 20, alignSelf: 'center' }} contentFit="cover" />
    <Label style={{ writingDirection: 'ltr', textAlign: 'center' }}>{selected.social === 'instagram' ? 'Instagram' : 'Facebook'}</Label>
    <NativeAction title="عرض حساب المطعم" systemImage="arrow.up.right.square" onPress={openAccount} />
    {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
  </EditorSheet> : null}</>;
}
// PORT STATUS: source resources/js/Pages/Shawarma/Index.tsx; confidence medium; todos 1 native ranking/logo and restaurant sheet verification.
