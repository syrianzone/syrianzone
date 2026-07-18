import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { guessWhoApi } from './api';
import {
  chooseSecret,
  createGameState,
  negotiationAttemptTimes,
  parseGameMessage,
  passTurn,
  peerClosed,
  peerOpened,
  receivePeerMessage,
  requestGuess,
  selectReadyMessage,
  stateSyncMessage,
  toggleElimination,
  type GuessWhoGameMessage,
  type GuessWhoGameState,
} from './model';
import { createNativePeerConnection } from './nativePeer';
import { GuessWhoPeer } from './peer';
import {
  connectGuessWhoPresence,
  type GuessWhoPresenceConnection,
} from './presence';
import type {
  GuessWhoBoundSession,
  GuessWhoPresenceMember,
  GuessWhoRoomSnapshot,
} from './types';

export type GuessWhoTransportStatus =
  | 'connected'
  | 'connecting'
  | 'error'
  | 'inactive'
  | 'manual'
  | 'retrying'
  | 'waiting';

export interface GuessWhoRoomController {
  chooseSecret: (characterId: number) => void;
  dismissNotice: () => void;
  game: GuessWhoGameState | null;
  guess: (characterId: number) => void;
  loading: boolean;
  opponentName: string;
  passTurn: () => void;
  reconnect: () => void;
  retry: () => void;
  roomError: string | null;
  snapshot: GuessWhoRoomSnapshot | null;
  toggleElimination: (characterId: number) => void;
  transportStatus: GuessWhoTransportStatus;
}

function safeGameMessage(value: string): GuessWhoGameMessage | null {
  if (value.length > 16_384) {
    return null;
  }
  try {
    return parseGameMessage(JSON.parse(value));
  } catch {
    return null;
  }
}

export function useGuessWhoRoom(
  entry: GuessWhoBoundSession,
): GuessWhoRoomController {
  const [snapshot, setSnapshot] = useState<GuessWhoRoomSnapshot | null>(null);
  const [game, setGame] = useState<GuessWhoGameState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transportStatus, setTransportStatus] =
    useState<GuessWhoTransportStatus>('connecting');
  const [opponentName, setOpponentName] = useState('الخصم');
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const gameRef = useRef<GuessWhoGameState | null>(null);
  const peerRef = useRef<GuessWhoPeer | null>(null);
  const presenceRef = useRef<GuessWhoPresenceConnection | null>(null);
  const opponentRef = useRef<GuessWhoPresenceMember | null>(null);
  const generationRef = useRef(entry.generation);
  const retryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const terminalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const replaceGame = useCallback(
    (transform: (current: GuessWhoGameState) => GuessWhoGameState) => {
      const current = gameRef.current;
      if (!current) {
        return null;
      }
      const next = transform(current);
      gameRef.current = next;
      setGame(next);
      return next;
    },
    [],
  );

  const clearRetries = useCallback(() => {
    for (const timer of retryTimers.current) {
      clearTimeout(timer);
    }
    retryTimers.current = [];
  }, []);

  const closeTransport = useCallback(() => {
    clearRetries();
    presenceRef.current?.close();
    presenceRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    opponentRef.current = null;
  }, [clearRetries]);

  const sendGameMessage = useCallback((message: GuessWhoGameMessage) => {
    return peerRef.current?.send(JSON.stringify(message)) ?? false;
  }, []);

  const closeAfterTerminalMessage = useCallback(() => {
    if (terminalTimer.current) {
      clearTimeout(terminalTimer.current);
    }
    terminalTimer.current = setTimeout(() => {
      peerRef.current?.close();
      peerRef.current = null;
      presenceRef.current?.close();
      presenceRef.current = null;
      setTransportStatus('inactive');
    }, 150);
  }, []);

  const handlePeerMessage = useCallback(
    (rawMessage: string) => {
      const message = safeGameMessage(rawMessage);
      const current = gameRef.current;
      if (!message || !current) {
        return;
      }
      const result = receivePeerMessage(
        current,
        message,
        opponentRef.current?.name ?? 'الخصم',
      );
      if (result.outbound) {
        sendGameMessage(result.outbound);
      }
      gameRef.current = result.state;
      setGame(result.state);
      if (result.state.phase === 'ended') {
        closeAfterTerminalMessage();
      }
    },
    [closeAfterTerminalMessage, sendGameMessage],
  );

  const scheduleNegotiation = useCallback(
    (member: GuessWhoPresenceMember, peer: GuessWhoPeer) => {
      if (peer.isOpen) {
        return;
      }
      clearRetries();
      const attemptTimes = negotiationAttemptTimes();
      if (entry.role !== 'player_1') {
        const manualTimer = setTimeout(() => {
          if (peer === peerRef.current && !peer.isOpen) {
            setTransportStatus('manual');
          }
        }, (attemptTimes.at(-1) ?? 0) + 5_000);
        retryTimers.current.push(manualTimer);
        return;
      }
      attemptTimes.forEach((elapsed, attempt) => {
        const timer = setTimeout(() => {
          if (peer !== peerRef.current || peer.isOpen) {
            return;
          }
          setTransportStatus(attempt === 0 ? 'connecting' : 'retrying');
          generationRef.current += 1;
          void peer
            .beginOffer(member.session_id, generationRef.current)
            .catch(() => setTransportStatus('error'));
        }, elapsed);
        retryTimers.current.push(timer);
      });
      const manualTimer = setTimeout(() => {
        if (peer === peerRef.current && !peer.isOpen) {
          setTransportStatus('manual');
        }
      }, (attemptTimes.at(-1) ?? 0) + 5_000);
      retryTimers.current.push(manualTimer);
    },
    [clearRetries, entry.role],
  );

  useEffect(() => {
    let live = true;
    const abortController = new AbortController();

    void Promise.all([
      guessWhoApi.getRoom(
        entry.room_code,
        entry.credential,
        abortController.signal,
      ),
      guessWhoApi.getRealtimeConfig(abortController.signal),
    ])
      .then(([freshSnapshot, realtimeConfig]) => {
        if (!live) {
          return;
        }
        setSnapshot(freshSnapshot);
        generationRef.current = Math.max(
          generationRef.current,
          freshSnapshot.generation,
        );
        if (!gameRef.current) {
          const initial = createGameState(freshSnapshot);
          gameRef.current = initial;
          setGame(initial);
        }

        const peer = new GuessWhoPeer({
          callbacks: {
            onChannelClose() {
              replaceGame(peerClosed);
              setTransportStatus('waiting');
              const member = opponentRef.current;
              const currentPeer = peerRef.current;
              if (member && currentPeer) {
                scheduleNegotiation(member, currentPeer);
              }
            },
            onChannelOpen() {
              clearRetries();
              const connected = replaceGame(peerOpened);
              setTransportStatus('connected');
              if (connected?.my_secret_id !== null) {
                sendGameMessage(selectReadyMessage());
              }
              if (connected) {
                sendGameMessage(stateSyncMessage(connected));
              }
            },
            onError() {
              setTransportStatus('error');
            },
            onMessage: handlePeerMessage,
            onStateChange(state) {
              if (state === 'failed' || state === 'disconnected') {
                replaceGame(peerClosed);
                setTransportStatus('waiting');
                const member = opponentRef.current;
                if (member) {
                  scheduleNegotiation(member, peer);
                }
              }
            },
          },
          createPeerConnection: createNativePeerConnection,
          getIceServers: async () => {
            const credentials = await guessWhoApi.getTurnCredentials(
              entry.room_code,
              entry.credential,
            );
            return credentials.ice_servers;
          },
          sendSignal: (request) =>
            guessWhoApi.sendSignal(
              entry.room_code,
              entry.credential,
              request,
            ),
        });
        peerRef.current = peer;

        const acceptMember = (member: GuessWhoPresenceMember) => {
          if (member.session_id === entry.session_id) {
            return;
          }
          opponentRef.current = member;
          setOpponentName(member.name || 'لاعب آخر');
          setTransportStatus('connecting');
          scheduleNegotiation(member, peer);
        };
        const presence = connectGuessWhoPresence(
          realtimeConfig,
          entry.credential,
          entry.room_code,
          {
            onError() {
              setTransportStatus('error');
            },
            onHere(members) {
              const other = members.find(
                (member) => member.session_id !== entry.session_id,
              );
              if (other) {
                acceptMember(other);
              } else {
                setTransportStatus('waiting');
              }
            },
            onJoining: acceptMember,
            onLeaving(member) {
              if (member.session_id === opponentRef.current?.session_id) {
                clearRetries();
                peer.disconnect();
                opponentRef.current = null;
                replaceGame(peerClosed);
                setTransportStatus('waiting');
              }
            },
            onSignal(signal) {
              if (signal.target_session === entry.session_id) {
                void peer
                  .handleSignal(signal)
                  .catch(() => setTransportStatus('error'));
              }
            },
            onStatus(status) {
              if (status === 'connected' && !opponentRef.current) {
                setTransportStatus('waiting');
              } else if (status === 'failed') {
                setTransportStatus('error');
              }
            },
          },
        );
        presenceRef.current = presence;
        setLoading(false);
      })
      .catch(() => {
        if (live && !abortController.signal.aborted) {
          setRoomError('تعذر تحميل غرفة اللعب. تحقق من الرمز وحاول مجدداً.');
          setTransportStatus('error');
          setLoading(false);
        }
      });

    return () => {
      live = false;
      abortController.abort();
      clearRetries();
      if (presenceRef.current) {
        presenceRef.current.close();
        presenceRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    };
  }, [
    clearRetries,
    connectionEpoch,
    entry.credential,
    entry.role,
    entry.room_code,
    entry.session_id,
    handlePeerMessage,
    replaceGame,
    scheduleNegotiation,
    sendGameMessage,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appState.current;
      appState.current = nextState;
      if (nextState !== 'active') {
        closeTransport();
        replaceGame(peerClosed);
        setTransportStatus('inactive');
      } else if (previous !== 'active') {
        setLoading(true);
        setRoomError(null);
        setTransportStatus('connecting');
        setConnectionEpoch((current) => current + 1);
      }
    });
    return () => subscription.remove();
  }, [closeTransport, replaceGame]);

  useEffect(
    () => () => {
      if (terminalTimer.current) {
        clearTimeout(terminalTimer.current);
      }
      closeTransport();
    },
    [closeTransport],
  );

  const choose = useCallback(
    (characterId: number) => {
      const selected = replaceGame((current) =>
        chooseSecret(current, characterId),
      );
      if (selected && peerRef.current?.isOpen) {
        sendGameMessage(selectReadyMessage());
        sendGameMessage(stateSyncMessage(selected));
      }
    },
    [replaceGame, sendGameMessage],
  );

  const guess = useCallback(
    (characterId: number) => {
      const current = gameRef.current;
      if (!current) {
        return;
      }
      const result = requestGuess(current, characterId);
      if (result.outbound) {
        sendGameMessage(result.outbound);
      }
      gameRef.current = result.state;
      setGame(result.state);
    },
    [sendGameMessage],
  );

  const eliminate = useCallback(
    (characterId: number) => {
      const current = gameRef.current;
      if (!current) {
        return;
      }
      const result = toggleElimination(current, characterId);
      if (result.outbound) {
        sendGameMessage(result.outbound);
      }
      gameRef.current = result.state;
      setGame(result.state);
    },
    [sendGameMessage],
  );

  const endTurn = useCallback(() => {
    const current = gameRef.current;
    if (!current) {
      return;
    }
    const result = passTurn(current);
    if (result.outbound) {
      sendGameMessage(result.outbound);
    }
    gameRef.current = result.state;
    setGame(result.state);
  }, [sendGameMessage]);

  const reconnect = useCallback(() => {
    closeTransport();
    replaceGame(peerClosed);
    setLoading(true);
    setRoomError(null);
    setTransportStatus('connecting');
    setConnectionEpoch((current) => current + 1);
  }, [closeTransport, replaceGame]);

  const dismissNotice = useCallback(() => {
    replaceGame((current) => ({ ...current, notice: null }));
  }, [replaceGame]);

  return {
    chooseSecret: choose,
    dismissNotice,
    game,
    guess,
    loading,
    opponentName,
    passTurn: endTurn,
    reconnect,
    retry: reconnect,
    roomError,
    snapshot,
    toggleElimination: eliminate,
    transportStatus,
  };
}
