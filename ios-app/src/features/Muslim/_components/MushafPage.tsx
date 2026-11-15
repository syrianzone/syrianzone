import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AyahMark } from '../../../ui/graphics';
import { NativeSymbol } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import { splitPartTokens } from '../../../platform/quran/source-rules';
import type { QuranPage } from '../../../platform/quran/mushaf';

interface Props {
  data: QuranPage; width: number; height: number; currentAyahKey: string | null; savedKeys: ReadonlySet<string>;
  activeWordKey?: string | null; activeWordProgress?: number | null; bookmarkBusy: boolean;
  onSelectAyah(key: string): void; onPlayAyah(key: string): void; onToggleBookmark(key: string): void;
}
export default function MushafPage({ data, width, height, currentAyahKey, savedKeys, activeWordKey, activeWordProgress, bookmarkBusy, onSelectAyah, onPlayAyah, onToggleBookmark }: Props): React.JSX.Element {
  const { colors } = useTheme(), [parts, setParts] = useState<Record<string, number>>({}), [markers, setMarkers] = useState<Record<number, number>>({});
  const tap = useRef({ key: '', at: 0 });
  const naturalWidth = data.lineWidth + 4, lineHeight = data.fontSize * 2.1, naturalHeight = lineHeight * 15 + 8;
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  const wordCounters = new Map<string, number>();
  function measure(key: string, measured: number): void { setParts(previous => Math.abs((previous[key] ?? -1) - measured) < 0.1 ? previous : { ...previous, [key]: measured }); }
  function select(key: string): void {
    const now = Date.now();
    onSelectAyah(key);
    if (tap.current.key === key && now - tap.current.at < 320) { onPlayAyah(key); tap.current = { key: '', at: 0 }; }
    else tap.current = { key, at: now };
  }
  return <View style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
    <View style={{ position: 'absolute', start: 0, top: 0, width: naturalWidth, height: naturalHeight, paddingHorizontal: 2, paddingVertical: 4,
      transform: [{ scale }], transformOrigin: 'top right' }}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', opacity: 0, width: 1000, top: -2000 }}>
        {['١', '١٢', '١٢٣'].map(digits => <Text key={digits} allowFontScaling={false} numberOfLines={1}
          style={{ fontFamily: 'QuranHafs', fontSize: data.fontSize, writingDirection: 'rtl' }} onTextLayout={event => {
            const measured = event.nativeEvent.lines[0]?.width;
            if (measured && measured > 0) setMarkers(previous => previous[digits.length] === measured ? previous : { ...previous, [digits.length]: measured });
          }}>{`﴿${digits}﴾`}</Text>)}
      </View>
      {data.lines.map(line => {
        const lineId = `${data.page}:${line.lineNumber}`;
        const measured = line.parts.reduce((sum, _part, position) => sum + (parts[`${lineId}:${position}`] ?? 0), 0);
        const ready = line.parts.every((_part, position) => parts[`${lineId}:${position}`] !== undefined) && Object.keys(markers).length === 3;
        const requested = line.stretch * data.stretchScale;
        const stretch = line.stretch < 0 ? 1 : measured > 0 && measured * requested > data.lineWidth + 0.5 ? data.lineWidth / measured : requested;
        return <View key={lineId} style={{ width: data.lineWidth, height: lineHeight, justifyContent: 'center' }}>
          {line.isTitle ? <View style={{ position: 'absolute', start: 0, end: 0, top: 2, bottom: 2, borderColor: colors.accent, borderWidth: 1.5, borderRadius: 6, backgroundColor: colors.accentMuted, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ position: 'absolute', start: 2, end: 2, top: 2, bottom: 2, borderColor: colors.accent, borderWidth: 0.8, borderRadius: 4 }} />
            <Text allowFontScaling={false} style={{ fontFamily: 'QuranHafs', color: colors.text, fontSize: data.fontSize * 1.15 }}>{line.titleText}</Text>
          </View> : line.isBasmalah ? <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: 'QuranHafs', color: colors.accent, fontSize: data.fontSize * 1.2, textAlign: 'center', writingDirection: 'rtl' }}>{line.basmalahText}</Text>
            : <View style={{ position: 'absolute', start: line.stretch < 0 && measured ? (data.lineWidth - measured) / 2 : 0, top: 0,
              width: measured || 10000, height: lineHeight, flexDirection: 'row', opacity: ready ? 1 : 0,
              transform: [{ scaleX: stretch > 0 ? stretch : 1 }], transformOrigin: 'right center' }}>
              {line.parts.map((part, position) => {
                const key = part.realAyah > 0 ? `${part.surah + 1}:${part.realAyah}` : null, selected = key === currentAyahKey;
                return <Pressable key={position} disabled={!key} accessible={Boolean(key)} accessibilityRole="button"
                  accessibilityLabel={key ? `سورة ${part.surah + 1}، آية ${part.realAyah}، ${part.rawText}` : undefined}
                  accessibilityActions={key ? [{ name: 'activate', label: 'تحديد الآية' }, { name: 'play', label: 'تشغيل الآية' }] : []}
                  onAccessibilityAction={event => { if (key) { if (event.nativeEvent.actionName === 'play') onPlayAyah(key); else onSelectAyah(key); } }}
                  onPress={() => { if (key) select(key); }} onLayout={event => measure(`${lineId}:${position}`, event.nativeEvent.layout.width)}
                  style={{ flexDirection: 'row', flexShrink: 0, height: lineHeight, alignItems: 'center', backgroundColor: selected ? colors.accentMuted : 'transparent', borderRadius: 4 }}>
                  {splitPartTokens(part.rawText).map((token, offset) => {
                    if (token.kind === 'marker') return <View key={offset} style={{ width: markers[token.digits.length] ?? data.fontSize * 2.4, height: lineHeight, alignItems: 'center', justifyContent: 'center' }}>
                      <AyahMark digits={token.digits} width={markers[token.digits.length] ?? data.fontSize * 2.4} />
                      {selected && key ? <Pressable accessibilityRole="button" accessibilityLabel={savedKeys.has(key) ? 'إزالة العلامة' : 'إضافة علامة'} disabled={bookmarkBusy}
                        onPress={event => { event.stopPropagation(); onToggleBookmark(key); }}
                        style={{ position: 'absolute', height: 44, width: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.separator, alignItems: 'center', justifyContent: 'center' }}>
                        <NativeSymbol name={savedKeys.has(key) ? 'bookmark.fill' : 'bookmark'} size={23} />
                      </Pressable> : null}
                    </View>;
                    const counterKey = key ?? `${part.surah}:${part.ayah}`, index = wordCounters.get(counterKey) ?? 0;
                    if (token.kind === 'word') wordCounters.set(counterKey, index + 1);
                    const active = token.kind === 'word' && key !== null && activeWordKey === `${key}:${index}`;
                    return <View key={offset} accessible={false} style={{ position: 'relative', justifyContent: 'center' }}>
                      {active ? <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: `${Math.max(0, Math.min(1, activeWordProgress ?? 1)) * 100}%`, backgroundColor: colors.accentMuted }} /> : null}
                      <Text allowFontScaling={false} style={{ fontFamily: 'QuranHafs', fontSize: data.fontSize, lineHeight,
                        color: active ? colors.accent : colors.text, writingDirection: 'rtl', textDecorationLine: key && savedKeys.has(key) ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: colors.accent }}>{token.value}</Text>
                    </View>;
                  })}
                </Pressable>;
              })}
            </View>}
        </View>;
      })}
    </View>
  </View>;
}

// PORT STATUS: source resources/js/Pages/Muslim/_components/MushafPage.tsx; confidence medium; todos 1 native glyph metrics, Ayah hit regions and ornament verification on iPhone.
