import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { AdaptivePanes, contentStyle } from '../src/components';
import { UserEditor } from '../src/features/UsersAdmin/Editor';
import { decodeOptions, initialForm, type UserForm } from '../src/features/UsersAdmin/model';
import { useTheme } from '../src/ui/theme';
import optionsDTO from './users-editor-options.json';

const options = decodeOptions(optionsDTO);
const optionsSHA256 = 'ba7edf3b4a3a85c1f4e77773c8914b20323e6488af3cabe209f3d3bebe4f4d88';
type MarkerData = { kind: string; [key: string]: string | number | boolean | null };
type Marker = MarkerData & { at: number };

function EditorMount({ generation, record, children }: {
  generation: number; record(marker: MarkerData): void; children: React.ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    record({ kind: 'editor-mount', generation });
    return () => record({ kind: 'editor-unmount', generation });
  }, [generation, record]);
  return <View testID="adapter.users-input.editor" collapsable={false} accessible={false}
    onLayout={event => {
      const { x, y, width, height } = event.nativeEvent.layout;
      record({ kind: 'editor-layout', generation, x, y, width, height });
    }}>{children}</View>;
}

// Test entry only. The actual editor and its FormField remain unchanged.
export function UsersEditorInputFixture(): React.JSX.Element {
  const [id] = useState(() => randomUUID().toLowerCase());
  const [visible, setVisible] = useState(false), [generation, setGeneration] = useState(0);
  const [form, setForm] = useState<UserForm | null>(null), [snapshot, setSnapshot] = useState('{}');
  const currentName = form?.name;
  const { colors } = useTheme();
  const startedAt = useRef(performance.now()), sequence = useRef(0);
  const events = useRef<string[]>([]), timeline = useRef<Marker[]>([]), forbiddenAttempts = useRef<string[]>([]);
  const referenceIDs = useRef(new WeakMap<object, number>()), referenceSequence = useRef(0);
  const lastNameFocusedReferenceID = useRef<number | null>(null), context = useRef({ generation });
  context.current = { generation };
  const focusedReferenceID = useCallback((): number | null => {
    const input = TextInput.State.currentlyFocusedInput();
    if (!input) return null;
    let referenceID = referenceIDs.current.get(input);
    if (referenceID === undefined) { referenceID = ++referenceSequence.current; referenceIDs.current.set(input, referenceID); }
    return referenceID;
  }, []);
  const record = useCallback((marker: MarkerData) => {
    timeline.current = [...timeline.current.slice(-239), { ...context.current, ...marker, at: performance.now() - startedAt.current }];
  }, []);
  useEffect(() => {
    if (!visible || form !== null) return;
    setForm(initialForm(null, options));
    record({ kind: 'source-initial-form-installed' });
  }, [form, record, visible]);
  useEffect(() => {
    if (currentName !== undefined) record({ kind: 'controlled-name-context-committed', name: currentName, generation });
  }, [currentName, generation, record]);
  const update = (patch: Partial<UserForm>): void => {
    if (typeof patch.name === 'string') {
      events.current = [...events.current.slice(-79), patch.name];
      lastNameFocusedReferenceID.current = focusedReferenceID();
      record({ kind: 'source-name-patch', name: patch.name, focusedReferenceID: lastNameFocusedReferenceID.current });
    } else record({ kind: 'other-source-patch', keys: Object.keys(patch).join(',') });
    setForm(previous => previous ? { ...previous, ...patch } : previous);
  };
  const forbidden = (action: string): void => {
    forbiddenAttempts.current = [...forbiddenAttempts.current, action];
    record({ kind: 'forbidden-action', action });
    setSnapshot(JSON.stringify({ id, terminalFailure: action }));
  };
  const capture = (): void => setSnapshot(JSON.stringify({
    id, generation, sequence: ++sequence.current, name: form?.name ?? null,
    sourceForm: { id: form?.id ?? null, role: form?.role ?? null, passwordIsEmpty: form?.password === '', emailIsEmpty: form?.email === '' },
    focusedReferenceID: focusedReferenceID(), lastNameFocusedReferenceID: lastNameFocusedReferenceID.current,
    events: events.current, timeline: timeline.current, forbiddenAttempts: forbiddenAttempts.current,
    options: { actorID: options.actorId, roles: options.roles.length, groups: options.groups.length,
      permissions: options.groups.reduce((sum, group) => sum + group.permissions.length, 0), cities: options.cities.length, sha256: optionsSHA256 }
  }));
  const open = (): void => {
    events.current = []; timeline.current = []; forbiddenAttempts.current = []; lastNameFocusedReferenceID.current = null;
    setForm(null); setSnapshot('{}'); setGeneration(previous => previous + 1); setVisible(true);
    record({ kind: 'presentation-requested' });
  };
  return <View>
    <Text testID="adapter.users-input.id" style={{ color: '#111111' }}>{id}</Text>
    <Button testID="adapter.users-input.open" title="Open actual UserEditor page sheet" onPress={open} />
    <Text style={{ color: '#111111' }}>Synthetic name only. Complete local options. No account, request, save or reload.</Text>
    <Modal visible={visible} presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}
      onShow={() => record({ kind: 'modal-on-show' })}>
      <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={event => {
        const { x, y, width, height } = event.nativeEvent.layout;
        record({ kind: 'modal-body-layout', x, y, width, height });
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button testID="adapter.users-input.capture" title="Capture UserEditor input" onPress={capture} />
          <Button testID="adapter.users-input.close" title="Close UserEditor diagnostic" onPress={() => setVisible(false)} />
        </View>
        <Text testID="adapter.users-input.snapshot" accessibilityLabel={snapshot} style={{ height: 1, fontSize: 1 }}>{snapshot}</Text>
        <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
          {form ? <EditorMount key={generation} generation={generation} record={record}>
            <UserEditor form={form} original={null} options={options} busy={false} fields={{}} update={update}
              onSave={() => forbidden('save')} onReload={() => forbidden('reload')} />
          </EditorMount> : <Text>جارٍ قراءة سجل المستخدم.</Text>}
        </ScrollView>} />
      </View>
    </Modal>
  </View>;
}
