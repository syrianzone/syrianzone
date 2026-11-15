import { Button, ColorPicker, DatePicker, Host, Menu, Picker, Slider, Text, Toggle } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, accessibilityValue, buttonStyle, controlSize, disabled, foregroundStyle, frame, labelStyle, lineLimit, menuIndicator, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useTheme } from './theme';

export function NativeThemeHost({ children, ignoreSafeArea = 'all', ...props }: Omit<ComponentProps<typeof Host>, 'colorScheme' | 'seedColor'>): React.JSX.Element {
  const { colors, mode } = useTheme();
  // React Native owns the surrounding safe area and keyboard layout for these inline controls.
  return <Host {...props} ignoreSafeArea={ignoreSafeArea} colorScheme={mode} seedColor={colors.accent} layoutDirection="rightToLeft">{children}</Host>;
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
    <NativeThemeHost matchContents={{ vertical: true }} style={[{ alignSelf: 'stretch' }, props.style]}>
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

export function NativeToggle(props: { title: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }): React.JSX.Element {
  return (
    <NativeThemeHost matchContents={{ vertical: true }}>
      <Toggle label={props.title} isOn={props.value} onIsOnChange={props.onChange} modifiers={[accessibilityLabel(props.title), disabled(props.disabled ?? false), frame({ minHeight: 44 })]} />
    </NativeThemeHost>
  );
}

export function NativeDatePicker({ label, value, onChange, disabled: isDisabled = false }: {
  label: string; value: Date; onChange(value: Date): void; disabled?: boolean;
}): React.JSX.Element {
  return <NativeThemeHost matchContents={{ vertical: true }}><DatePicker title={label} selection={value}
    displayedComponents={['date']} onDateChange={onChange} modifiers={[accessibilityLabel(label), disabled(isDisabled)]} /></NativeThemeHost>;
}

export function NativeColorPicker({ label, value, onChange, disabled: isDisabled = false }: {
  label: string; value: string; onChange(value: string): void; disabled?: boolean;
}): React.JSX.Element {
  return <NativeThemeHost matchContents={{ vertical: true }}><ColorPicker label={label} selection={value} supportsOpacity={false}
    onSelectionChange={color => { if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)) onChange(color.slice(0, 7)); }}
    modifiers={[accessibilityLabel(label), disabled(isDisabled)]} /></NativeThemeHost>;
}

export function NativeIconAction({ title, systemImage, onPress, disabled: isDisabled = false }: {
  title: string; systemImage: SFSymbol; onPress(): void; disabled?: boolean;
}): React.JSX.Element {
  return <NativeThemeHost style={{ width: 44, height: 44 }}><Button label={title} systemImage={systemImage} onPress={onPress}
    modifiers={[labelStyle('iconOnly'), buttonStyle('bordered'), controlSize('regular'), frame({ width: 44, height: 44 }), accessibilityLabel(title), disabled(isDisabled)]} /></NativeThemeHost>;
}

export function NativePicker<T extends string>(props: {
  options: readonly { label: string; value: T }[]; value: T; onChange(value: T): void; label: string; disabled?: boolean;
}): React.JSX.Element {
  const selected = props.options.find(option => option.value === props.value);
  return <NativeThemeHost matchContents={{ vertical: true }}>
    <Menu label={<Text modifiers={[lineLimit(1)]}>{selected?.label ?? props.label}</Text>}
      modifiers={[menuIndicator('visible'), disabled(props.disabled ?? false), accessibilityIdentifier(props.label), accessibilityLabel(props.label), ...(selected ? [accessibilityValue(selected.label)] : [])]}>
      <Picker label={props.label} selection={props.value} onSelectionChange={props.onChange} modifiers={[pickerStyle('inline')]}>
        {props.options.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}
      </Picker>
    </Menu>
  </NativeThemeHost>;
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

export function NativeSlider({ label, value, onChange, min = 0, max = 1, step = 0.01 }: {
  label: string; value: number; onChange(value: number): void; min?: number; max?: number; step?: number;
}): React.JSX.Element {
  return <NativeThemeHost matchContents={{ vertical: true }}><Slider value={value} min={min} max={max} step={step} onValueChange={onChange}
    label={<Text>{label}</Text>} modifiers={[accessibilityIdentifier(label)]} /></NativeThemeHost>;
}

export type { SFSymbol, ReactNode };
