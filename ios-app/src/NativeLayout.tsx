import { requireNativeView } from 'expo';
import { StyleSheet, type NativeSyntheticEvent, type ViewProps } from 'react-native';
import type { LayoutMetrics } from './layout';

interface ObserverProps extends ViewProps {
  readonly onMetricsChange: (event: NativeSyntheticEvent<LayoutMetrics>) => void;
}

const Observer = requireNativeView<ObserverProps>('SyrianZoneLayout', 'Metrics');

export function NativeLayoutObserver({ onChange }: { readonly onChange: (metrics: LayoutMetrics) => void }): React.JSX.Element {
  return <Observer pointerEvents="none" style={StyleSheet.absoluteFill} onMetricsChange={event => onChange(event.nativeEvent)} />;
}
