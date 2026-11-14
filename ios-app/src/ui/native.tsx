import { Button, Host, Picker, Text, Toggle } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled, foregroundStyle, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useTheme } from './theme';

export function NativeThemeHost({ children, ...props }: Omit<ComponentProps<typeof Host>, 'colorScheme' | 'seedColor'>): React.JSX.Element {
  const { colors, mode } = useTheme();
  return <Host {...props} colorScheme={mode} seedColor={colors.accent} layoutDirection="rightToLeft">{children}</Host>;
}

export function NativeAction(props: {
  title: string;
  systemImage?: SFSymbol;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  prominent?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <NativeThemeHost matchContents={{ vertical: true }} style={props.style}>
      <Button
        label={props.title}
        {...(props.systemImage ? { systemImage: props.systemImage } : {})}
        role={props.destructive ? 'destructive' : 'default'}
        onPress={props.onPress}
        modifiers={[
          buttonStyle(props.prominent ? 'borderedProminent' : 'bordered'),
          ...(props.prominent ? [foregroundStyle(colors.onAccent)] : []),
          controlSize('large'),
          disabled(props.disabled ?? false),
          accessibilityLabel(props.title),
          frame({ maxWidth: Infinity, minHeight: 44 })
        ]}
      />
    </NativeThemeHost>
  );
}

export function NativeSegmented<T extends string>(props: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <NativeThemeHost matchContents={{ vertical: true }}>
      <Picker
        label={props.label ?? 'اختيار العرض'}
        selection={props.value}
        onSelectionChange={props.onChange}
        modifiers={[pickerStyle('segmented'), disabled(props.disabled ?? false)]}
      >
        {props.options.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}
      </Picker>
    </NativeThemeHost>
  );
}

export function NativeToggle(props: { title: string; value: boolean; onChange: (value: boolean) => void }): React.JSX.Element {
  return (
    <NativeThemeHost matchContents={{ vertical: true }}>
      <Toggle label={props.title} isOn={props.value} onIsOnChange={props.onChange} modifiers={[accessibilityLabel(props.title)]} />
    </NativeThemeHost>
  );
}

export function NativeSymbol({ name, size = 22, color, label }: { name: SFSymbol; size?: number; color?: string; label?: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={name}
      tintColor={color ?? colors.accent}
      size={size}
      style={{ width: size, height: size }}
      {...(label ? { accessibilityLabel: label } : { accessible: false })}
    />
  );
}

export type { SFSymbol, ReactNode };
