import { requireNativeView } from 'expo';
import { TextInput, type NativeSyntheticEvent, type ViewProps } from 'react-native';
import { useScreenActive } from './lifecycle';

export type NativeShortcut = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'w' | 'a' | 's' | 'd' | 'W' | 'A' | 'S' | 'D' | 'h' | 'l' | '[' | ']' | '1' | '2' | '3' | '4' | '5';
export interface NativeKeyCommandsProps { active?: boolean; physicalDirections?: boolean; commands: readonly NativeShortcut[]; onKey(key: NativeShortcut): void }
interface KeyProps extends ViewProps { active: boolean; physicalDirections: boolean; commands: readonly string[]; onKeyCommand(event: NativeSyntheticEvent<{ key: NativeShortcut }>): void }
const Keys = requireNativeView<KeyProps>('SyrianZoneLayout', 'Keys');
export function NativeKeyCommands({ active = true, physicalDirections = false, commands, onKey }: NativeKeyCommandsProps): React.JSX.Element {
  const focused = useScreenActive();
  const enabled = active && focused;
  return <Keys active={enabled} physicalDirections={physicalDirections} commands={commands} accessible={false} pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, top: 0, start: 0 }}
    onKeyCommand={event => { if (enabled && !TextInput.State.currentlyFocusedInput() && commands.includes(event.nativeEvent.key)) onKey(event.nativeEvent.key); }} />;
}
