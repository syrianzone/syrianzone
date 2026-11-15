import { useState } from 'react';
import { Button, Text, View, useWindowDimensions } from 'react-native';
import { NativeIconAction } from '../src/ui/native';
import { ThemeProvider, themeColors, type AppearanceMode } from '../src/ui/theme';

type Layout = { x: number; y: number; width: number; height: number };

// Only the unchanged shipping icon button can increment its callback counter.
export function IconActionHitFixture(): React.JSX.Element {
  const [mode, setMode] = useState<AppearanceMode>('light');
  const [counts, setCounts] = useState({ light: 0, dark: 0 });
  const [layout, setLayout] = useState<Layout | null>(null);
  const window = useWindowDimensions(), colors = themeColors[mode];
  const observation = JSON.stringify({ mode, count: counts[mode], layout,
    window: { width: window.width, height: window.height, fontScale: window.fontScale, scale: window.scale } });
  return <ThemeProvider mode={mode}><View style={{ padding: 16, gap: 16, backgroundColor: colors.background }}>
    <Text style={{ fontSize: 17, color: colors.text }}>Unchanged production NativeIconAction</Text>
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <Button testID="adapter.icon-hit.light" title="Light" onPress={() => setMode('light')} />
      <Button testID="adapter.icon-hit.dark" title="Dark" onPress={() => setMode('dark')} />
    </View>
    <View testID="adapter.icon-hit.slot" collapsable={false} accessible={false} style={{ alignSelf: 'center' }}
      onLayout={event => { const { x, y, width, height } = event.nativeEvent.layout; setLayout({ x, y, width, height }); }}>
      <NativeIconAction title="إعدادات الرئيسية" systemImage="slider.horizontal.3"
        onPress={() => setCounts(current => ({ ...current, [mode]: current[mode] + 1 }))} />
    </View>
    <Text style={{ fontSize: 15, color: colors.text }}>Native callback count: {counts[mode]}</Text>
    <Text testID="adapter.icon-hit.state" accessibilityValue={{ text: observation }}
      style={{ fontSize: 12, color: colors.secondary }}>ICON HIT STATE</Text>
    <Text style={{ fontSize: 13, color: colors.secondary }}>Real screen taps only. The wrapper adds no padding, hit handler, clipping or button style.</Text>
  </View></ThemeProvider>;
}
