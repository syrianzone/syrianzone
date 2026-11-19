import { useRef, useState } from 'react';
import { Button, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { SearchField } from '../src/components';
import { NativeSymbol } from '../src/ui/native';
import { useTheme } from '../src/ui/theme';

type Mode = 'shared' | 'clip';
type Target = 'email' | 'mixed';
type Layout = { x: number; y: number; width: number; height: number };
const placeholder = 'ابحث بالاسم أو البريد الإلكتروني';
function query(id: string, target: Target): string {
  const email = `native-users-${id}-a@native-fixture.invalid`;
  return target === 'email' ? email : `بحث عربي عن مستخدم ${email} في دمشق وحلب`;
}

// Adapter-only observation of the current production SearchField and the prior
// clip-only comparator, which intentionally has no input overflow clipping.
export function SearchFieldFixture(): React.JSX.Element {
  const [id] = useState(() => randomUUID().toLowerCase());
  const [mode, setMode] = useState<Mode>('shared'), [target, setTarget] = useState<Target>('email');
  const [generation, setGeneration] = useState(0), [value, setValue] = useState(() => query(id, 'email'));
  const [snapshot, setSnapshot] = useState('{}');
  const latest = useRef(value), changes = useRef<string[]>([]), layout = useRef<Layout | null>(null), sequence = useRef(0);
  const referenceIDs = useRef(new WeakMap<object, number>()), referenceSequence = useRef(0);
  const clearCount = useRef(0), changeCount = useRef(0);
  const lastSearchChange = useRef<{ text: string; focusedReferenceID: number | null } | null>(null);
  const window = useWindowDimensions(), { colors } = useTheme();
  const focusedID = (): number | null => {
    const focused = TextInput.State.currentlyFocusedInput();
    if (!focused) return null;
    const identity = referenceIDs.current.get(focused) ?? ++referenceSequence.current;
    referenceIDs.current.set(focused, identity); return identity;
  };
  const change = (text: string): void => {
    latest.current = text; changes.current = [...changes.current.slice(-63), text];
    changeCount.current++; if (text === '') clearCount.current++;
    lastSearchChange.current = { text, focusedReferenceID: focusedID() };
    setValue(text);
  };
  const select = (nextMode: Mode, nextTarget: Target): void => {
    const text = query(id, nextTarget);
    layout.current = null; latest.current = text; changes.current = [];
    clearCount.current = 0; changeCount.current = 0; lastSearchChange.current = null;
    setMode(nextMode); setTarget(nextTarget); setValue(text); setGeneration(current => current + 1); setSnapshot('{}');
  };
  const capture = (): void => {
    const focusedReferenceID = focusedID();
    setSnapshot(JSON.stringify({ id, mode, target, generation, sequence: ++sequence.current,
      implementation: mode === 'shared' ? 'current-production-search-field' : 'prior-clip-only-input-without-overflow',
      controlledValue: value, latestChange: latest.current, changes: changes.current, clearCount: clearCount.current,
      changeCount: changeCount.current, lastSearchChange: lastSearchChange.current,
      focusedReferenceID, wrapperLayout: layout.current,
      window: { width: window.width, height: window.height, scale: window.scale, fontScale: window.fontScale } }));
  };
  return <View style={{ gap: 12, backgroundColor: colors.background }}>
    <Text testID="adapter.search.id" style={{ color: colors.text }}>{id}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {(['shared', 'clip'] as const).flatMap(item => (['email', 'mixed'] as const).map(next => <Button key={`${item}.${next}`}
        testID={`adapter.search.select.${item}.${next}`} title={`${item} ${next}`} onPress={() => select(item, next)} />))}
    </View>
    <Text style={{ color: colors.text }}>{mode === 'shared' ? 'Current production SearchField' : 'Prior clip-only input, without overflow clipping'}</Text>
    <View key={`${mode}.${target}.${generation}`} testID={`adapter.search.field.${mode}.${target}`} collapsable={false} accessible={false}
      onLayout={event => { const { x, y, width, height } = event.nativeEvent.layout; layout.current = { x, y, width, height }; }}>
      {mode === 'shared' ? <SearchField value={value} onChange={change} placeholder={placeholder} />
        : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 12, backgroundColor: colors.elevated }}>
          <NativeSymbol name="magnifyingglass" color={colors.secondary} size={19} />
          <TextInput value={value} onChangeText={change} placeholder={placeholder} accessibilityLabel={placeholder}
            placeholderTextColor={colors.secondary} clearButtonMode="while-editing" returnKeyType="search" autoCorrect={false}
            lineBreakModeIOS="clip"
            style={{ flex: 1, minHeight: 48, color: colors.text, fontSize: 17, textAlign: 'right', writingDirection: 'rtl' }} />
        </View>}
    </View>
    <TextInput accessibilityLabel="حقل التركيز التالي للبحث" autoCorrect={false} returnKeyType="done" submitBehavior="blurAndSubmit"
      style={{ minHeight: 44, borderWidth: 1, borderColor: colors.separator, color: colors.text }} />
    <Button testID="adapter.search.capture" title="Capture synthetic search drawing state" onPress={capture} />
    <Text style={{ color: colors.text }}>Initial values are synthetic prefills. Focused values are retyped through XCTest. Screenshots require visual review.</Text>
    <Text testID="adapter.search.snapshot" accessibilityLabel={snapshot} style={{ width: 1, height: 1, fontSize: 1 }}>{snapshot}</Text>
  </View>;
}
