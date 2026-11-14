import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { NativeAction, NativeSymbol, type SFSymbol } from './ui/native';
import { useTheme } from './ui/theme';
import { deriveLayout, type LayoutMetrics, type Rect } from './layout';
import { NativeLayoutObserver } from './NativeLayout';
import type { Resource } from './resource';

export function Label({ children, secondary, style, ...props }: {
  children: ReactNode; secondary?: boolean; style?: StyleProp<TextStyle>; accessibilityRole?: 'header';
}): React.JSX.Element {
  const { colors } = useTheme();
  return <Text {...props} style={[{ color: secondary ? colors.secondary : colors.text, fontSize: 16, lineHeight: 25, textAlign: 'start', writingDirection: 'rtl' }, style]}>{children}</Text>;
}

export function Section({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 22, padding: 18, gap: 12 }, style]}>{children}</View>;
}

export function Heading({ children, subtitle }: { children: ReactNode; subtitle?: string }): React.JSX.Element {
  return <View style={{ gap: 6 }}><Label style={{ fontSize: 28, lineHeight: 38, fontWeight: '700' }} accessibilityRole="header">{children}</Label>{subtitle ? <Label secondary>{subtitle}</Label> : null}</View>;
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }): React.JSX.Element {
  const { colors } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 12, backgroundColor: colors.elevated }}>
    <NativeSymbol name="magnifyingglass" color={colors.secondary} size={19} />
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} accessibilityLabel={placeholder}
      placeholderTextColor={colors.secondary} clearButtonMode="while-editing" returnKeyType="search" autoCorrect={false}
      style={{ flex: 1, minHeight: 48, color: colors.text, fontSize: 17, textAlign: 'right', writingDirection: 'rtl' }} />
  </View>;
}

export function EmptyState({ symbol = 'magnifyingglass', title, detail }: { symbol?: SFSymbol; title: string; detail?: string }): React.JSX.Element {
  return <View style={{ padding: 28, gap: 12, alignItems: 'center' }}><NativeSymbol name={symbol} size={34} /><Label style={{ fontWeight: '600', textAlign: 'center' }}>{title}</Label>{detail ? <Label secondary style={{ textAlign: 'center' }}>{detail}</Label> : null}</View>;
}

export function RequestStatus<T>({ resource }: { resource: Resource<T> }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (resource.loading && !resource.data) return <View style={{ padding: 28, gap: 12 }}><ActivityIndicator accessibilityLabel="جارٍ التحميل" color={colors.accent} /><Label secondary style={{ textAlign: 'center' }}>جارٍ التحميل</Label></View>;
  if (resource.error) return <Section><Label style={{ color: colors.danger }} >{resource.error}</Label><NativeAction title="إعادة المحاولة" systemImage="arrow.clockwise" onPress={resource.reload} /></Section>;
  return null;
}

export function Row({ title, subtitle, symbol, onPress, trailing, selected }: {
  title: string; subtitle?: string; symbol?: SFSymbol; onPress(): void; trailing?: ReactNode; selected?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join('، ')}
    accessibilityState={{ selected: selected ?? false }} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, minHeight: 66, borderRadius: 15,
      backgroundColor: selected ? colors.accentMuted : colors.surface, opacity: pressed ? 0.7 : 1 })}>
    {symbol ? <NativeSymbol name={symbol} /> : null}<View style={{ flex: 1 }}><Label style={{ fontWeight: '600' }}>{title}</Label>{subtitle ? <Label secondary style={{ fontSize: 13, lineHeight: 20 }}>{subtitle}</Label> : null}</View>
    {trailing ?? <NativeSymbol name="chevron.backward" size={14} color={colors.secondary} />}
  </Pressable>;
}

export function Photo({ url, label, height = 190 }: { url: string | null; label: string; height?: number }): React.JSX.Element {
  const { colors } = useTheme();
  return url ? <Image source={{ uri: url }} accessibilityLabel={label} contentFit="cover" cachePolicy="memory-disk" recyclingKey={url}
    style={{ height, width: '100%', borderRadius: 16, backgroundColor: colors.elevated }} />
    : <View style={{ height, borderRadius: 16, backgroundColor: colors.accentMuted, justifyContent: 'center', alignItems: 'center' }}><NativeSymbol name="mountain.2" size={42} /></View>;
}

// Observe the content window, not the screen. UIKit already owns navigation-bar space.
export function AdaptivePanes({ primary, secondary, compact }: { primary: ReactNode; secondary?: ReactNode; compact?: ReactNode }): React.JSX.Element {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [metrics, setMetrics] = useState<LayoutMetrics | null>(null);
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // Accessibility text uses the scrollable compact presentation instead of short side-by-side panes.
  const layout = deriveLayout(metrics, bounds.width, bounds.height, secondary != null && fontScale < 1.5);
  return <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={event => setBounds(event.nativeEvent.layout)}>
    <NativeLayoutObserver onChange={setMetrics} />
    {bounds.width > 0 && bounds.height > 0 ? <>
      <View style={[styles.pane, panePosition(layout.primary)]}>{layout.secondary ? primary : compact ?? primary}</View>
      {layout.secondary ? <View style={[styles.pane, panePosition(layout.secondary)]}>{secondary}</View> : null}
    </> : null}
  </View>;
}

function panePosition(rect: Rect): ViewStyle {
  // Native RTL makes end the physical left edge, without React Native's left/right remapping.
  return { end: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

export const contentStyle: ViewStyle = { padding: 18, paddingBottom: 32, gap: 16 };
const styles = StyleSheet.create({ pane: { position: 'absolute', overflow: 'hidden' } });
