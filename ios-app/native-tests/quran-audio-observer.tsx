import { NativeModule, requireNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeAudioStatus } from '../src/platform/quran/engine';

declare class ObservedAudio extends NativeModule<{ onStatus: (status: NativeAudioStatus) => void }> {}

// Read-only test visibility. The real App/AudioProvider remains the sole player owner.
export function QuranAudioObserver({ reads }: { reads: Readonly<Record<string, number>> }): React.JSX.Element {
  const [snapshot, setSnapshot] = useState('WAITING FOR REAL AUDIO');
  useEffect(() => {
    const native = requireNativeModule<ObservedAudio>('SyrianAudio');
    const listener = native.addListener('onStatus', status => {
      const rounded = (value: number) => Math.round(value * 10) / 10;
      setSnapshot(JSON.stringify({ owner: 'SyrianAudio', observedAt: Date.now(), trackGeneration: status.token, seconds: rounded(status.seconds), duration: rounded(status.duration),
        listenedSeconds: rounded(status.listenedSeconds), playing: status.playing, loading: status.loading, loaded: status.loaded,
        sleepUntil: status.sleepUntil ?? null, failed: typeof status.error === 'string' && status.error.length > 0 }));
    });
    return () => listener.remove();
  }, []);
  return <View>
    <Text testID="audio.fixture.owner" numberOfLines={1} style={{ color: '#111111', fontSize: 9 }}>REAL AudioProvider / SyrianAudio, native track generation</Text>
    <Text testID="audio.fixture.native" accessibilityLabel={snapshot} numberOfLines={1} style={{ color: '#111111', fontSize: 8 }}>{snapshot}</Text>
    <Text testID="audio.fixture.metadata" accessibilityLabel={JSON.stringify(reads)} numberOfLines={1} style={{ color: '#111111', fontSize: 8 }}>{JSON.stringify(reads)}</Text>
  </View>;
}
