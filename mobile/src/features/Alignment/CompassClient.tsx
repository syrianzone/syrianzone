import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download, Palette, Plus, RotateCcw, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  readJsonPreference,
  writeJsonPreference,
} from '@/lib/storage/preferences';

import {
  alignmentStateSchema,
  canAddCompassDot,
  closestDot,
  compassSvg,
  createDot,
  defaultAxes,
  defaultCompassColors,
  type AlignmentState,
} from './model';
import { ColorEditor } from './ColorEditor';
import { shareCompassRaster, type CompassRasterFormat } from './sharing';

const storageKey = 'politicalCompass';

export default function CompassClient() {
  const { theme } = useAppTheme();
  const [state, setState] = useState<AlignmentState>({
    axes: defaultAxes,
    colors: defaultCompassColors,
    dots: [],
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [size, setSize] = useState(300);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const captureTarget = useRef<View>(null);
  const activeDot = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void readJsonPreference(storageKey, alignmentStateSchema).then((stored) => {
      if (active && stored) {
        setState(stored);
      }
      if (active) {
        setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      void writeJsonPreference(storageKey, state);
    }
  }, [hydrated, state]);

  const beginGesture = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX / size;
    const y = event.nativeEvent.locationY / size;
    const existing = closestDot(state.dots, x, y, 22 / size);
    if (existing) {
      activeDot.current = existing.id;
      setSelectedId(existing.id);
      return;
    }
    if (!canAddCompassDot(state.dots)) {
      setMessage('بلغت الحد الأقصى وهو 50 نقطة.');
      return;
    }
    const dot = createDot(state.dots, x, y);
    activeDot.current = dot.id;
    setSelectedId(dot.id);
    setState((current) => ({ ...current, dots: [...current.dots, dot] }));
  };
  const moveGesture = (event: GestureResponderEvent) => {
    const id = activeDot.current;
    if (id === null) {
      return;
    }
    const x = Math.max(0, Math.min(1, event.nativeEvent.locationX / size));
    const y = Math.max(0, Math.min(1, event.nativeEvent.locationY / size));
    setState((current) => ({
      ...current,
      dots: current.dots.map((dot) =>
        dot.id === id ? { ...dot, x, y } : dot,
      ),
    }));
  };

  const selected = state.dots.find((dot) => dot.id === selectedId);
  const onLayout = (event: LayoutChangeEvent) => {
    const nextSize = Math.min(event.nativeEvent.layout.width, 560);
    setSize(nextSize);
  };
  const exportImage = async (format: CompassRasterFormat) => {
    if (!captureTarget.current) {
      return;
    }
    try {
      const shared = await shareCompassRaster(captureTarget.current, format);
      setMessage(
        shared
          ? `تم تجهيز ملف ${format.toUpperCase()} للمشاركة.`
          : 'المشاركة غير متاحة على هذا الجهاز.',
      );
    } catch {
      setMessage('تعذر تصدير الصورة. حاول مرة أخرى.');
    }
  };
  const exportSvg = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      setMessage('المشاركة غير متاحة على هذا الجهاز.');
      return;
    }
    const file = new File(Paths.cache, 'syrian-alignment.svg');
    try {
      file.create({ overwrite: true });
      file.write(compassSvg(state));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'image/svg+xml',
        UTI: 'public.svg-image',
      });
      setMessage('تم تجهيز ملف SVG للمشاركة.');
    } catch {
      setMessage('تعذر تصدير ملف SVG. حاول مرة أخرى.');
    } finally {
      if (file.exists) {
        file.delete();
      }
    }
  };

  return (
    <View style={styles.root}>
      <AppCard style={styles.instructions}>
        <AppText color="muted">
          اضغط على الخريطة لإضافة نقطة، ثم اسحبها لتغيير موقعها.
        </AppText>
      </AppCard>
      <View onLayout={onLayout} style={styles.canvasContainer}>
        <View
          collapsable={false}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={beginGesture}
          onResponderMove={moveGesture}
          onResponderRelease={() => {
            activeDot.current = null;
          }}
          onStartShouldSetResponder={() => true}
          ref={captureTarget}
          style={{ height: size, width: size }}
        >
          <Svg height={size} width={size}>
            <Rect fill={state.colors.topLeft} height={size / 2} width={size / 2} />
            <Rect
              fill={state.colors.topRight}
              height={size / 2}
              width={size / 2}
              x={size / 2}
            />
            <Rect
              fill={state.colors.bottomLeft}
              height={size / 2}
              width={size / 2}
              y={size / 2}
            />
            <Rect
              fill={state.colors.bottomRight}
              height={size / 2}
              width={size / 2}
              x={size / 2}
              y={size / 2}
            />
            <Line stroke="#ffffff" strokeWidth={2} x1={size / 2} x2={size / 2} y1={0} y2={size} />
            <Line stroke="#ffffff" strokeWidth={2} x1={0} x2={size} y1={size / 2} y2={size / 2} />
            <SvgText fill="#ffffff" fontSize={13} x={10} y={size / 2 - 10}>{state.axes.left}</SvgText>
            <SvgText fill="#ffffff" fontSize={13} textAnchor="end" x={size - 10} y={size / 2 - 10}>{state.axes.right}</SvgText>
            <SvgText fill="#ffffff" fontSize={13} textAnchor="middle" x={size / 2} y={20}>{state.axes.top}</SvgText>
            <SvgText fill="#ffffff" fontSize={13} textAnchor="middle" x={size / 2} y={size - 10}>{state.axes.bottom}</SvgText>
            {state.dots.map((dot) => (
              <Circle
                cx={dot.x * size}
                cy={dot.y * size}
                fill={dot.color}
                key={dot.id}
                r={selectedId === dot.id ? 10 : 8}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
            {state.dots.map((dot) => (
              <SvgText
                fill="#ffffff"
                fontSize={11}
                key={`label-${dot.id}`}
                textAnchor="middle"
                x={dot.x * size}
                y={dot.y * size - 14}
              >
                {dot.name}
              </SvgText>
            ))}
          </Svg>
        </View>
      </View>

      <AppCard style={styles.form}>
        <AppText variant="heading">تسمية المحاور</AppText>
        {(['left', 'right', 'top', 'bottom'] as const).map((key) => (
          <AppInput
            key={key}
            maxLength={40}
            onChangeText={(value) =>
              setState((current) => ({
                ...current,
                axes: { ...current.axes, [key]: value },
              }))
            }
            value={state.axes[key]}
          />
        ))}
      </AppCard>

      <AppCard style={styles.form}>
        <View style={styles.sectionHeading}>
          <Palette color={theme.palette.primary} size={20} />
          <AppText variant="heading">ألوان الأقسام</AppText>
        </View>
        {([
          ['topLeft', 'أعلى اليسار'],
          ['topRight', 'أعلى اليمين'],
          ['bottomLeft', 'أسفل اليسار'],
          ['bottomRight', 'أسفل اليمين'],
        ] as const).map(([key, label]) => (
          <ColorEditor
            color={state.colors[key]}
            key={`${key}:${state.colors[key]}`}
            label={label}
            onChange={(color) =>
              setState((current) => ({
                ...current,
                colors: { ...current.colors, [key]: color },
              }))
            }
          />
        ))}
      </AppCard>

      {selected ? (
        <AppCard style={styles.form}>
          <AppText variant="heading">النقطة المحددة</AppText>
          <AppInput
            maxLength={60}
            onChangeText={(name) =>
              setState((current) => ({
                ...current,
                dots: current.dots.map((dot) =>
                  dot.id === selected.id ? { ...dot, name } : dot,
                ),
              }))
            }
            value={selected.name}
          />
          <AppButton
            icon={<Trash2 color={theme.palette.primaryForeground} size={18} />}
            onPress={() => {
              setState((current) => ({
                ...current,
                dots: current.dots.filter((dot) => dot.id !== selected.id),
              }));
              setSelectedId(null);
            }}
            variant="danger"
          >
            حذف النقطة
          </AppButton>
        </AppCard>
      ) : (
        <AppButton
          disabled={!canAddCompassDot(state.dots)}
          icon={<Plus color={theme.palette.primaryForeground} size={18} />}
          onPress={() => {
            const dot = createDot(state.dots, 0.5, 0.5);
            setState((current) => ({ ...current, dots: [...current.dots, dot] }));
            setSelectedId(dot.id);
          }}
        >
          إضافة نقطة في الوسط
        </AppButton>
      )}

      <View style={styles.exportRow}>
        <AppButton
          icon={<Download color={theme.palette.primaryForeground} size={18} />}
          onPress={() => void exportImage('png')}
        >
          PNG
        </AppButton>
        <AppButton
          icon={<Download color={theme.palette.foreground} size={18} />}
          onPress={() => void exportImage('jpg')}
          variant="secondary"
        >
          JPG
        </AppButton>
        <AppButton
          icon={<Download color={theme.palette.foreground} size={18} />}
          onPress={() => void exportSvg()}
          variant="secondary"
        >
          SVG
        </AppButton>
      </View>
      {message ? (
        <AppText color="muted" variant="caption">{message}</AppText>
      ) : null}
      <AppButton
        icon={<RotateCcw color={theme.palette.foreground} size={18} />}
        onPress={() => {
          setState({ axes: defaultAxes, colors: defaultCompassColors, dots: [] });
          setSelectedId(null);
        }}
        variant="secondary"
      >
        إعادة التعيين
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasContainer: {
    alignItems: 'center',
    width: '100%',
  },
  exportRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 8,
  },
  form: {
    gap: 10,
  },
  instructions: {
    gap: 8,
  },
  root: {
    gap: 14,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Alignment/CompassClient.tsx (504 lines)
  confidence: high
  todos:      0
  notes:      SVG gestures replace canvas events while persistence, color editing, and PNG, JPG, or SVG exports remain.
*/
