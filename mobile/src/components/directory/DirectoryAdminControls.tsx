import * as ImagePicker from 'expo-image-picker';
import { ArrowDown, ArrowUp, ImagePlus } from 'lucide-react-native';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import type { PickedDirectoryImage } from '@/lib/api/directories/admin';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

interface VisibilityFieldProps {
  label?: string;
  onChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
}

export function DirectoryVisibilityField({
  label = 'ظاهر في الدليل العام',
  onChange,
  testID,
  value,
}: VisibilityFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.visibility}>
      <AppText style={styles.visibilityLabel} variant="label">
        {label}
      </AppText>
      <Switch
        onValueChange={onChange}
        thumbColor={value ? theme.palette.primaryForeground : undefined}
        trackColor={{
          false: theme.palette.border,
          true: theme.palette.primary,
        }}
        testID={testID}
        value={value}
      />
    </View>
  );
}

interface OrderActionsProps {
  busy?: boolean;
  first: boolean;
  last: boolean;
  onDown: () => void;
  onUp: () => void;
}

export function DirectoryOrderActions({
  busy = false,
  first,
  last,
  onDown,
  onUp,
}: OrderActionsProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.order}>
      <AppButton
        accessibilityLabel="تحريك إلى الأعلى"
        disabled={first || busy}
        icon={<ArrowUp color={theme.palette.foreground} size={17} />}
        onPress={onUp}
        variant="secondary"
      >
        أعلى
      </AppButton>
      <AppButton
        accessibilityLabel="تحريك إلى الأسفل"
        disabled={last || busy}
        icon={<ArrowDown color={theme.palette.foreground} size={17} />}
        onPress={onDown}
        variant="secondary"
      >
        أسفل
      </AppButton>
    </View>
  );
}

export async function pickSquareDirectoryImage(): Promise<
  PickedDirectoryImage | null
> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('اسمح بالوصول إلى الصور لاختيار ملف.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.85,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) {
    return null;
  }

  return {
    filename: asset.fileName ?? `directory-${Date.now()}.jpg`,
    uri: asset.uri,
  };
}

export function DirectoryImagePickerButton({
  image,
  onChange,
}: {
  image: PickedDirectoryImage | null;
  onChange: (image: PickedDirectoryImage | null) => void;
}) {
  const { theme } = useAppTheme();

  const pick = async () => {
    try {
      const selected = await pickSquareDirectoryImage();
      if (selected) {
        onChange(selected);
      }
    } catch (cause) {
      Alert.alert(
        'تعذر اختيار الصورة',
        cause instanceof Error ? cause.message : 'حاول مرة أخرى.',
      );
    }
  };

  return (
    <View style={styles.imagePicker}>
      <AppButton
        icon={<ImagePlus color={theme.palette.foreground} size={18} />}
        onPress={() => void pick()}
        variant="secondary"
      >
        {image ? 'تغيير الصورة' : 'اختيار صورة'}
      </AppButton>
      {image ? (
        <AppText color="muted" variant="caption">
          {image.filename}
        </AppText>
      ) : null}
    </View>
  );
}

export function moveDirectoryId(
  ids: readonly string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ids.length) {
    return [...ids];
  }
  const next = [...ids];
  const current = next[index];
  const replacement = next[nextIndex];
  if (current === undefined || replacement === undefined) {
    return next;
  }
  next[index] = replacement;
  next[nextIndex] = current;
  return next;
}

const styles = StyleSheet.create({
  imagePicker: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  order: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  visibility: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'space-between',
  },
  visibilityLabel: {
    flex: 1,
  },
});
