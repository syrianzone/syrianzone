import { useEffect, useRef, useState, type Ref } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../ui/theme';
import { addDot, dotAt, moveDot, normalizePoint, type Alignment, type Point } from './model';

export function AlignmentDrawing({
  state,
  disabled,
  svgRef,
  onChange,
  onSelect,
  onDraggingChange
}: {
  state: Alignment;
  disabled: boolean;
  svgRef: Ref<Svg>;
  onChange(change: (previous: Alignment) => Alignment): void;
  onSelect(id: number): void;
  onDraggingChange(dragging: boolean): void;
}): React.JSX.Element {
  const { colors } = useTheme(),
    size = useRef(0),
    dragging = useRef<{ id: number; offset: Point } | null>(null),
    current = useRef({ state, disabled, onChange, onSelect, onDraggingChange });
  current.current = { state, disabled, onChange, onSelect, onDraggingChange };
  useEffect(() => () => {
    if (dragging.current) {
      dragging.current = null;
      current.current.onDraggingChange(false);
    }
  }, []);
  const [dimension, setDimension] = useState(600),
    center = dimension / 2;
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.disabled,
      onMoveShouldSetPanResponder: () => !current.current.disabled && dragging.current !== null,
      onPanResponderGrant: (event) => {
        if (current.current.disabled || size.current <= 0) return;
        const point = normalizePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, size.current),
          dot = dotAt(current.current.state.dots, point, size.current);
        if (dot) {
          dragging.current = { id: dot.id, offset: { x: point.x - dot.x, y: point.y - dot.y } };
          current.current.onDraggingChange(true);
          current.current.onSelect(dot.id);
        } else {
          current.current.onChange((previous) => {
            const next = addDot(previous, point, Date.now());
            current.current.onSelect(next.dots.at(-1)!.id);
            return next;
          });
          dragging.current = null;
        }
      },
      onPanResponderMove: (event) => {
        const drag = dragging.current;
        if (!drag || current.current.disabled || size.current <= 0) return;
        const point = normalizePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, size.current);
        current.current.onChange((previous) => moveDot(previous, drag.id, { x: point.x - drag.offset.x, y: point.y - drag.offset.y }));
      },
      onPanResponderRelease: () => {
        if (dragging.current) {
          dragging.current = null;
          current.current.onDraggingChange(false);
        }
      },
      onPanResponderTerminate: () => {
        if (dragging.current) {
          dragging.current = null;
          current.current.onDraggingChange(false);
        }
      },
      onPanResponderTerminationRequest: () => false
    })
  );
  return (
    <View style={{ borderWidth: 4, borderColor: colors.separator, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
      <View
        pointerEvents="box-only"
        {...responder.panHandlers}
        onLayout={(event) => {
          size.current = event.nativeEvent.layout.width;
          if (size.current > 0) setDimension(size.current);
        }}
        style={{ width: '100%', aspectRatio: 1 }}
        accessibilityLabel={`بوصلة مخصصة، ${state.dots.length} نقطة. تتوفر أدوات بديلة لإضافة النقاط وتعديل مواضعها في القائمة.`}
        accessibilityRole="image"
      >
        <Svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${dimension} ${dimension}`} accessible={false}>
          <Rect width={center} height={center} fill={state.colors.topLeft} />
          <Rect x={center} width={center} height={center} fill={state.colors.topRight} />
          <Rect y={center} width={center} height={center} fill={state.colors.bottomLeft} />
          <Rect x={center} y={center} width={center} height={center} fill={state.colors.bottomRight} />
          <Line x1={center} y1={0} x2={center} y2={dimension} stroke="#fff" strokeWidth={2} />
          <Line x1={0} y1={center} x2={dimension} y2={center} stroke="#fff" strokeWidth={2} />
          <G fill="#fff" fontSize={14} fontWeight="bold" textAnchor="middle">
            <SvgText x={40} y={center - 20}>
              {state.axes.left}
            </SvgText>
            <SvgText x={dimension - 40} y={center - 20}>
              {state.axes.right}
            </SvgText>
            <SvgText x={center + 20} y={30} transform={`rotate(90,${center + 20},30)`}>
              {state.axes.top}
            </SvgText>
            <SvgText x={center + 20} y={dimension - 30} transform={`rotate(90,${center + 20},${dimension - 30})`}>
              {state.axes.bottom}
            </SvgText>
          </G>
          {state.dots.map((dot) => (
            <G key={dot.id}>
              <Circle cx={dot.x * dimension} cy={dot.y * dimension} r={8} fill={dot.color} stroke="#fff" strokeWidth={2} />
              {dot.name ? (
                <SvgText
                  x={dot.x * dimension}
                  y={dot.y * dimension - 15}
                  fontSize={12}
                  textAnchor="middle"
                  fill="#fff"
                  stroke="#000"
                  strokeOpacity={0.35}
                  strokeWidth={0.5}
                >
                  {dot.name}
                </SvgText>
              ) : null}
            </G>
          ))}
        </Svg>
      </View>
    </View>
  );
}
// PORT STATUS: source Alignment/CompassClient.tsx canvas; confidence medium; todos 1 native drag and VoiceOver review. ViewBox coordinates stay physical and are not mirrored by RTL.
