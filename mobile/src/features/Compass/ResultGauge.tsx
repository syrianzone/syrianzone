import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { Scale } from './data';
import { compassPercentage, compassRating, gaugeMarkerPercent } from './model';

interface ResultGaugeProps {
  scale: Scale;
  value: number;
}

export function ResultGauge({ scale, value }: ResultGaugeProps) {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  const percentage = compassPercentage(value);

  return (
    <View style={styles.gauge}>
      <AppText variant="label">{scale.name}</AppText>
      <View
        style={[
          styles.poles,
          { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
        ]}
        testID={`compass-poles-${scale.id}`}
      >
        <AppText color="muted" style={styles.pole} variant="caption">
          {scale.left}
        </AppText>
        <View style={styles.readout}>
          <AppText color="primary" style={styles.centered} variant="label">
            {compassRating(value, scale)}
          </AppText>
          <AppText color="muted" style={styles.centered} variant="caption">
            نسبة {Math.round(percentage)}%
          </AppText>
        </View>
        <AppText color="muted" style={styles.pole} variant="caption">
          {scale.right}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.palette.border }]}>
        <View
          style={[
            styles.marker,
            {
              backgroundColor: theme.palette.foreground,
              left: `${gaugeMarkerPercent(value, direction)}%`,
            },
          ]}
          testID={`compass-marker-${scale.id}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  gauge: {
    gap: 6,
  },
  marker: {
    height: '100%',
    // Half the width, so the marker straddles its position like the web bar.
    marginLeft: -3,
    position: 'absolute',
    top: 0,
    width: 6,
  },
  pole: {
    flexShrink: 1,
    maxWidth: '28%',
  },
  poles: {
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'space-between',
  },
  readout: {
    flexShrink: 1,
  },
  track: {
    borderRadius: 6,
    height: 24,
    overflow: 'hidden',
    position: 'relative',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Compass/CompassApp.tsx (372 lines, results block)
  confidence: high
  todos:      0
  notes:      Pole labels follow the writing direction and the marker offset is
              mirrored so it always lands under the pole its rating names.
*/
