import { useEffect, useRef } from 'react';
import { useCurrentSong, usePlayerStore } from '../_lib/playerStore';

// the page's single <audio> element: everything controls it through the store
export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const song = useCurrentSong();
  const playing = usePlayerStore((s) => s.playing);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const tick = usePlayerStore((s) => s.tick);
  const onEnded = usePlayerStore((s) => s.onEnded);

  // persisted prefs (volume, saved tracks) load after mount, see hydratePrefs
  useEffect(() => usePlayerStore.getState().hydratePrefs(), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !song?.audio_url) return;
    if (playing) {
      audio.play().catch((e: unknown) => {
        // autoplay policy rejection gets a visible paused state; AbortError just
        // means a newer load/pause interrupted this play() and must not pause it
        if (e instanceof DOMException && e.name === 'AbortError') return;
        usePlayerStore.setState({ playing: false });
      });
    } else {
      audio.pause();
    }
  }, [playing, song?.id, song?.audio_url]);

  // navigating away unmounts the page's audio element; reset so the next page
  // does not silently resume a stale queue it renders no controls for
  useEffect(() => () => usePlayerStore.getState().reset(), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && seekTo !== null) {
      audio.currentTime = seekTo;
      usePlayerStore.setState({ seekTo: null });
      // repeat-one (and single-song wrap) rewinds after `ended` left the element
      // paused while the store still says playing: resume here
      if (usePlayerStore.getState().playing && audio.paused) audio.play().catch(() => {});
    }
  }, [seekTo]);

  useEffect(() => {
    const audio = audioRef.current;
    // song?.id in deps: the element only mounts once a song is set, so the
    // stored volume must be re-applied then, not just when the slider moves
    if (audio) audio.volume = muted ? 0 : volume;
  }, [volume, muted, song?.id]);

  if (!song?.audio_url) return null;

  return (
    <audio
      ref={audioRef}
      src={song.audio_url}
      preload="metadata"
      onTimeUpdate={(e) => tick(e.currentTarget.currentTime)}
      onEnded={onEnded}
      onError={() => usePlayerStore.setState({ playing: false })}
    />
  );
}
