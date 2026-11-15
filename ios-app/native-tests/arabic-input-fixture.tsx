import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Button, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { AdaptivePanes, FormField, contentStyle } from '../src/components';

type Mode = 'shared' | 'controlled' | 'uncontrolled' | 'no-correction';
type Target = 'user' | 'place' | 'prose';
type Presentation = 'inline' | 'sheet';
type MarkerData = { kind: string; [key: string]: string | number | boolean | null };
type Marker = MarkerData & { at: number };
const modes: readonly Mode[] = ['shared', 'controlled', 'uncontrolled', 'no-correction'];
const targets: readonly Target[] = ['user', 'place', 'prose'];
const fieldLabel = 'تشخيص الإدخال العربي';

function FieldLifecycle({ identity, testID, record, children }: {
  identity: string; testID: string; record(marker: MarkerData): void; children: ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    record({ kind: 'field-mount', identity });
    return () => record({ kind: 'field-unmount', identity });
  }, [identity, record]);
  return <View testID={testID} collapsable={false} accessible={false}
    onLayout={event => { const { x, y, width, height } = event.nativeEvent.layout; record({ kind: 'field-layout', identity, x, y, width, height }); }}>
    {children}
  </View>;
}

// Adapter entry only. The shipping FormField and its correction behavior are unchanged.
export function ArabicInputFixture(): React.JSX.Element {
  const [id] = useState(() => randomUUID().toLowerCase());
  const [mode, setMode] = useState<Mode>('shared'), [target, setTarget] = useState<Target>('user');
  const [presentation, setPresentation] = useState<Presentation>('inline'), [generation, setGeneration] = useState(0);
  const [value, setValue] = useState(''), [snapshot, setSnapshot] = useState('{}');
  const input = useRef<ComponentRef<typeof TextInput> | null>(null), latest = useRef('');
  const events = useRef<string[]>([]), timeline = useRef<Marker[]>([]), sequence = useRef(0);
  const startedAt = useRef(performance.now()), referenceIDs = useRef(new WeakMap<object, number>()), referenceSequence = useRef(0);
  const currentReferenceID = useRef<number | null>(null);
  const context = useRef({ mode, target, presentation, generation });
  context.current = { mode, target, presentation, generation };
  const record = useCallback((marker: MarkerData): void => {
    timeline.current = [...timeline.current.slice(-199), { ...context.current, ...marker, at: performance.now() - startedAt.current }];
  }, []);
  const inputRef = useCallback((node: ComponentRef<typeof TextInput> | null): void => {
    input.current = node;
    if (node) {
      let referenceID = referenceIDs.current.get(node);
      if (referenceID === undefined) { referenceID = ++referenceSequence.current; referenceIDs.current.set(node, referenceID); }
      currentReferenceID.current = referenceID;
      record({ kind: 'input-ref-attached', referenceID });
    } else {
      record({ kind: 'input-ref-detached', referenceID: currentReferenceID.current });
      currentReferenceID.current = null;
    }
  }, [record]);
  useEffect(() => {
    record({ kind: 'controlled-render-committed', text: value, mode, target, presentation, generation });
  }, [generation, mode, presentation, record, target, value]);
  const reset = () => { latest.current = ''; events.current = []; setValue(''); setSnapshot('{}'); };
  const change = (text: string) => {
    latest.current = text; events.current = [...events.current.slice(-79), text];
    record({ kind: 'on-change-text', text });
    if (mode !== 'uncontrolled') setValue(text);
  };
  const capture = () => setSnapshot(JSON.stringify({ id, mode, target, presentation, generation, sequence: ++sequence.current,
    inputFocused: input.current?.isFocused() === true, referenceID: currentReferenceID.current,
    text: latest.current, controlledValue: value, events: events.current, timeline: timeline.current }));
  const show = (next: Presentation) => {
    reset(); setGeneration(previous => previous + 1); setPresentation(next);
    record({ kind: 'presentation-requested', requestedPresentation: next });
  };
  const multiline = target === 'prose', maxLength = multiline ? 1000 : 160;
  const identity = `${mode}.${target}`, lifecycleIdentity = `${identity}.${generation}`;
  const body = <View style={{ flex: 1 }} onLayout={event => {
    const { x, y, width, height } = event.nativeEvent.layout;
    record({ kind: 'body-layout', x, y, width, height });
  }}>
    <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <Text testID="adapter.inputs.presentation" style={{ color: '#111111' }}>{presentation}</Text>
      <Button testID="adapter.inputs.capture" title="Capture Arabic input state" onPress={capture} />
      <FieldLifecycle key={lifecycleIdentity} identity={lifecycleIdentity} testID={`adapter.inputs.field.${identity}`} record={record}>
        {mode === 'shared' ? <FormField label={fieldLabel} value={value} onChange={change} multiline={multiline} maxLength={maxLength} inputRef={inputRef} />
          : <TextInput ref={inputRef} accessibilityLabel={fieldLabel} {...(mode === 'uncontrolled' ? { defaultValue: '' } : { value })}
            onChangeText={change} multiline={multiline} maxLength={maxLength} keyboardType="default" autoCapitalize="sentences" autoCorrect={mode !== 'no-correction'}
            style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#666666', color: '#111111', textAlign: 'right', writingDirection: 'rtl' }} />}
      </FieldLifecycle>
      <TextInput accessibilityLabel="حقل التركيز التالي" autoCorrect={false} style={{ minHeight: 44, borderWidth: 1, borderColor: '#666666', color: '#111111' }} />
      <Text style={{ color: '#111111', fontSize: 12 }}>Synthetic text only. Shared keeps the shipping FormField unchanged.</Text>
      <Text testID="adapter.inputs.snapshot" accessibilityLabel={snapshot} style={{ width: 1, height: 1, fontSize: 1 }}>{snapshot}</Text>
      {presentation === 'sheet' ? <Button testID="adapter.inputs.close-sheet" title="Close diagnostic page sheet" onPress={() => show('inline')} /> : null}
    </ScrollView>} />
  </View>;
  return <View style={{ gap: 8 }}>
    <Text testID="adapter.inputs.id" style={{ color: '#111111', fontSize: 12 }}>{id}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{modes.map(item => <Button key={item} testID={`adapter.inputs.mode.${item}`} title={item}
      onPress={() => { reset(); setMode(item); }} />)}</View>
    <View style={{ flexDirection: 'row' }}>{targets.map(item => <Button key={item} testID={`adapter.inputs.target.${item}`} title={item}
      onPress={() => { reset(); setTarget(item); }} />)}</View>
    <View style={{ flexDirection: 'row' }}>{(['inline', 'sheet'] as const).map(item => <Button key={item}
      testID={`adapter.inputs.presentation.${item}`} title={item === 'sheet' ? 'Open diagnostic page sheet' : 'New inline input'} onPress={() => show(item)} />)}</View>
    {presentation === 'inline' ? <View style={{ height: 500 }}>{body}</View> : <Modal visible presentationStyle="pageSheet"
      onShow={() => record({ kind: 'modal-on-show' })} onRequestClose={() => show('inline')}>{body}</Modal>}
  </View>;
}
