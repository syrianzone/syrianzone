import React, { useEffect, useState, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Share2, RefreshCw, HelpCircle, ArrowRight, X, Check, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import axios from 'axios';
import { getGuessWhoSessionId } from '@/Lib/guessWhoSession';
import { initEcho } from '@/echo';

interface Character {
  id: number;
  name_ar: string;
  image_path: string;
}

interface GameProps {
  game: {
    room_code: string;
    category: {
      name_ar: string;
      characters: Character[];
    };
  };
}

// 3D Flipped Card Component
function CharacterCard({
  char,
  myTurn,
  gameState,
  onChooseSecret,
  onGuess,
  onToggleEliminate
}: {
  char: Character & { eliminated: boolean };
  myTurn: boolean;
  gameState: 'lobby' | 'playing';
  onChooseSecret: (id: number) => void;
  onGuess: (id: number, name: string) => void;
  onToggleEliminate: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(true);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
    if (gameState === 'lobby') {
      onChooseSecret(char.id);
    } else {
      onGuess(char.id, char.name_ar);
    }
  };

  return (
    <div className="perspective-1000 w-full relative">
      <motion.div
        animate={{ rotateY: confirming ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="w-full relative preserve-3d"
      >
        {/* CARD FRONT */}
        <Card
          className={`relative backface-hidden flex flex-col justify-start overflow-hidden border p-1.5 sm:p-2 transition-all duration-300 ${
            char.eliminated
              ? 'border-destructive/20 bg-destructive/5 opacity-25 grayscale'
              : 'border-border bg-card hover:border-primary/50'
          }`}
        >
          <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex-shrink-0">
            <img src={`/storage/${char.image_path}`} alt={char.name_ar} className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-col gap-1 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-[11px] sm:text-sm font-bold text-foreground truncate text-center">{char.name_ar}</span>
            
            {gameState === 'lobby' && (
              <Button
                onClick={handleActionClick}
                className="w-full py-1 sm:py-1.5 h-auto text-[10px] sm:text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold rounded-lg"
              >
                اختيار الشخصية
              </Button>
            )}

            {gameState === 'playing' && (
              <div className="flex flex-col gap-1 sm:gap-1.5">
                {!char.eliminated && (
                  <Button
                    onClick={handleActionClick}
                    disabled={!myTurn}
                    className="w-full py-1 h-auto text-[10px] sm:text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    تخمين الشخصية
                  </Button>
                )}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEliminate(char.id);
                  }}
                  variant={char.eliminated ? 'secondary' : 'destructive'}
                  className="w-full py-1 h-auto text-[10px] sm:text-[11px] font-bold rounded-lg"
                >
                  {char.eliminated ? 'إرجاع' : 'استبعاد'}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* CARD BACK (INLINE CONFIRMATION) */}
        <Card className="absolute inset-0 backface-hidden rotate-y-180 bg-card border-primary/50 text-card-foreground p-1.5 sm:p-3 flex flex-col justify-between items-center text-center shadow-2xl">
          <div className="flex-grow flex flex-col justify-center items-center gap-1 sm:gap-2">
            <div className="p-1 sm:p-2 bg-primary/10 rounded-full border border-primary/30">
              <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <p className="text-foreground font-bold text-[10px] sm:text-xs leading-normal">
              {gameState === 'lobby' 
                ? 'هل تريد اختيار هذه كشخصيتك السرية؟' 
                : `هل أنت متأكد من تخمين: "${char.name_ar}"؟`}
            </p>
          </div>

          <div className="flex flex-col w-full gap-1 mt-1 sm:mt-2">
            <Button
              onClick={handleConfirm}
              className="w-full py-1 h-auto text-[10px] sm:text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold rounded-lg flex items-center justify-center gap-1"
            >
              <Check className="h-3 w-3" /> نعم
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="w-full py-1 h-auto text-[10px] sm:text-xs rounded-lg flex items-center justify-center gap-1"
            >
              <X className="h-3 w-3" /> إلغاء
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function GameRoom({ game }: GameProps) {
  const [sessionUuid] = useState(() => getGuessWhoSessionId());
  
  // Game States
  const [isJoined, setIsJoined] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(true);
  const [peerConnected, setPeerConnected] = useState(false);
  const [gameState, setGameState] = useState<'lobby' | 'selecting' | 'playing' | 'ended'>('lobby');
  const [board, setBoard] = useState<(Character & { eliminated: boolean })[]>([]);
  const [mySecret, setMySecretState] = useState<number | null>(null);
  const mySecretRef = useRef<number | null>(null);
  const setMySecret = (id: number | null) => {
    mySecretRef.current = id;
    setMySecretState(id);
  };

  const [opponentName, setOpponentNameState] = useState('الخصم');
  const opponentNameRef = useRef<string>('الخصم');
  const setOpponentName = (name: string) => {
    opponentNameRef.current = name;
    setOpponentNameState(name);
  };

  const [opponentRemaining, setOpponentRemaining] = useState(game.category.characters.length);

  const [peerUuid, setPeerUuidState] = useState<string | null>(null);
  const peerUuidRef = useRef<string | null>(null);
  const setPeerUuid = (uuid: string | null) => {
    peerUuidRef.current = uuid;
    setPeerUuidState(uuid);
  };

  const [myTurn, setMyTurn] = useState(false);
  const [winMessage, setWinMessage] = useState<string | null>(null);
  // Non-blocking peer disconnect banner (replaces the old alert())
  const [peerDisconnected, setPeerDisconnected] = useState(false);
  const peerReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebRTC Refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  // Debounce timer: collapses rapid Reverb leave/join flicker into one call attempt
  const initiateCallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join registration on mount to claim slot 1/2 and prevent 3rd player entry
  useEffect(() => {
    let active = true;
    const registerPlayer = async () => {
      try {
        await axios.post(`/guesswho/room/${game.room_code}/join`, {
          player_session: sessionUuid
        });
        if (active) {
          setIsJoined(true);
          setLoadingJoin(false);
        }
      } catch (err) {
        console.error('Room registration error:', err);
        if (active) {
          // Redirect full rooms or errors back to lobby index with warning query param
          router.visit('/guesswho?error=room_full');
        }
      }
    };
    registerPlayer();
    return () => {
      active = false;
    };
  }, [game.room_code, sessionUuid]);

  // Initialize board characters
  useEffect(() => {
    const items = game.category.characters.map(c => ({ ...c, eliminated: false }));
    // Shuffle board locally
    setBoard([...items].sort(() => Math.random() - 0.5));
  }, [game]);

  // Auto-transition from 'selecting' → 'playing' once peer connects and secret is chosen.
  // This prevents the game from starting while the data channel is not yet open.
  useEffect(() => {
    if (peerConnected && mySecret !== null && (gameState === 'selecting' || gameState === 'lobby')) {
      // Send directly via ref to avoid stale-closure on sendStateUpdate
      if (dataChannel.current?.readyState === 'open') {
        dataChannel.current.send(JSON.stringify({ action: 'select_ready', payload: { id: mySecret } }));
      }
      setGameState('playing');
    }
  }, [peerConnected, mySecret, gameState]);


  // Configure WebRTC and Laravel Echo listeners
  useEffect(() => {
    if (!isJoined) return;

    let activeEcho: any = null;
    let isMounted = true;
    const channelName = `guesswho.${game.room_code}`;

    initEcho().then((echo) => {
      if (!echo || !isMounted) return;
      activeEcho = echo;

      console.log('[GuessWho] Joining presence channel:', channelName, 'as session:', sessionUuid);

      echo.join(channelName)
        .here((users: any[]) => {
          console.log('[GuessWho] .here() fired, users in channel:', users);
          const other = users.find(u => u.session_id !== sessionUuid);
          if (other) {
            console.log('[GuessWho] Peer already in channel:', other.session_id);
            setPeerUuid(other.session_id);
            setOpponentName(other.name || 'لاعب آخر');
            if (sessionUuid < other.session_id) {
              console.log('[GuessWho] I have smaller UUID, scheduling call');
              scheduleCall(other.session_id);
            } else {
              console.log('[GuessWho] I have larger UUID, waiting for offer');
            }
          } else {
            console.log('[GuessWho] No peer in channel yet, waiting for joining event');
          }
        })
        .joining((user: any) => {
          console.log('[GuessWho] .joining() fired, new user:', user.session_id);
          setPeerUuid(user.session_id);
          setOpponentName(user.name || 'لاعب آخر');
          setPeerDisconnected(false);
          if (peerReconnectTimer.current) {
            clearTimeout(peerReconnectTimer.current);
            peerReconnectTimer.current = null;
          }
          if (sessionUuid < user.session_id) {
            console.log('[GuessWho] I have smaller UUID, scheduling call to joiner');
            scheduleCall(user.session_id);
          } else {
            console.log('[GuessWho] I have larger UUID, waiting for offer from joiner');
          }
        })
        .leaving((user: any) => {
          console.log('[GuessWho] .leaving() fired, user left:', user.session_id);
          if (user.session_id === peerUuidRef.current) {
            setPeerConnected(false);
            if (peerConnection.current) {
              try {
                peerConnection.current.close();
              } catch (err) {
                console.error('[GuessWho] Error closing peer connection on leaving:', err);
              }
              peerConnection.current = null;
              dataChannel.current = null;
              iceCandidateQueue.current = [];
            }
            peerReconnectTimer.current = setTimeout(() => {
              setPeerDisconnected(true);
            }, 5000);
          }
        })
        .error((error: any) => {
          console.error('[GuessWho] Presence channel subscription error:', error);
        })
        .listen('.signal', (e: any) => {
          console.log('[GuessWho] Signal received:', e.type, 'targetSession:', e.targetSession);
          if (e.targetSession === sessionUuid) {
            handleSignal(e);
          }
        });
    });

    return () => {
      isMounted = false;
      if (activeEcho) {
        activeEcho.leave(channelName);
      }
      peerConnection.current?.close();
      if (initiateCallTimer.current) clearTimeout(initiateCallTimer.current);
    };
  }, [game.room_code, sessionUuid, isJoined]);

  // Debounced call initiator — collapses rapid leave/join events into one stable attempt
  const scheduleCall = (targetSession: string) => {
    if (initiateCallTimer.current) clearTimeout(initiateCallTimer.current);
    initiateCallTimer.current = setTimeout(async () => {
      try {
        console.log('[GuessWho] Debounce resolved, initiating call to:', targetSession);
        await initiateCall(targetSession);
        console.log('[GuessWho] initiateCall completed — offer sent, waiting for answer');
      } catch (err) {
        console.error('[GuessWho] initiateCall failed:', err);
      }
    }, 800);
  };

  // Setup Peer Connection
  const createPeerConnection = (targetSession: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        // STUN — direct connection when NAT allows
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // TURN — relay fallback for symmetric NATs (Open Relay by Metered, free)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turns:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ]
    });

    // Log all state transitions for debugging
    pc.onconnectionstatechange = () =>
      console.log('[GuessWho] PC connectionState:', pc.connectionState);
    pc.onicegatheringstatechange = () =>
      console.log('[GuessWho] ICE gatheringState:', pc.iceGatheringState);
    pc.oniceconnectionstatechange = () =>
      console.log('[GuessWho] ICE connectionState:', pc.iceConnectionState);
    pc.onsignalingstatechange = () =>
      console.log('[GuessWho] signalingState:', pc.signalingState);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[GuessWho] Sending ICE candidate:', event.candidate.type);
        sendSignal(targetSession, 'candidate', event.candidate);
      } else {
        console.log('[GuessWho] ICE gathering complete');
      }
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    peerConnection.current = pc;
    return pc;
  };

  const setupDataChannel = (channel: RTCDataChannel) => {
    dataChannel.current = channel;
    channel.onopen = () => {
      setPeerConnected(true);
      const isPlayer1 = sessionUuid < (peerUuidRef.current || '');
      setMyTurn(isPlayer1);
    };
    channel.onclose = () => setPeerConnected(false);
    channel.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      handlePeerMessage(msg);
    };
  };

  const initiateCall = async (targetSession: string) => {
    // Close any stale connection before re-initiating (handles Reverb reconnect flicker)
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
      dataChannel.current = null;
      iceCandidateQueue.current = [];
    }
    const pc = createPeerConnection(targetSession);
    const dc = pc.createDataChannel('game_sync');
    setupDataChannel(dc);

    console.log('[GuessWho] Creating offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('[GuessWho] Sending offer, sdpType:', offer.type);
    await sendSignal(targetSession, 'offer', offer);
    console.log('[GuessWho] Offer sent — waiting for answer from:', targetSession);
  };

  const handleSignal = async (e: any) => {
    if (e.type === 'offer') {
      console.log('[GuessWho] Received new offer signal. Re-creating peer connection.');
      if (peerConnection.current) {
        try {
          peerConnection.current.close();
        } catch (err) {
          console.error('[GuessWho] Error closing peer connection on offer:', err);
        }
        peerConnection.current = null;
        dataChannel.current = null;
        iceCandidateQueue.current = [];
      }
    }

    const pc = peerConnection.current || createPeerConnection(e.senderSession);

    // Decode base64-encoded SDP (encoded by sender to protect \r\n in transit)
    const decodeSdp = (data: any): RTCSessionDescriptionInit => ({
      type: data.type,
      sdp: atob(data.sdp),
    });

    if (e.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(decodeSdp(e.data)));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(e.senderSession, 'answer', answer);
      // Drain any candidates that arrived before the remote description was set
      for (const candidate of iceCandidateQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidateQueue.current = [];
    } else if (e.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(decodeSdp(e.data)));
      // Drain any candidates that arrived before the remote description was set
      for (const candidate of iceCandidateQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidateQueue.current = [];
    } else if (e.type === 'candidate') {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(e.data));
      } else {
        // Queue candidate until remote description is ready
        iceCandidateQueue.current.push(e.data);
      }
    }
  };

  const sendSignal = async (targetSession: string, type: string, data: any) => {
    try {
      // Base64-encode the SDP string to protect \r\n line endings from
      // being mangled by PHP/JSON/WebSocket transit
      let payload = data;
      if ((type === 'offer' || type === 'answer') && data?.sdp) {
        payload = { ...data, sdp: btoa(data.sdp) };
      }
      await axios.post(`/guesswho/room/${game.room_code}/signal`, {
        target_session: targetSession,
        sender_session: sessionUuid,
        type,
        data: payload
      });
    } catch (err) {
      console.error('Failed to send signal:', err);
    }
  };

  // Sync state over RTCDatachannel
  const sendStateUpdate = (action: string, payload: any) => {
    if (dataChannel.current?.readyState === 'open') {
      dataChannel.current.send(JSON.stringify({ action, payload }));
    }
  };

  const handlePeerMessage = (msg: any) => {
    switch (msg.action) {
      case 'select_ready':
        break;
      case 'elimination_update':
        setOpponentRemaining(msg.payload.remaining);
        break;
      case 'guess':
        const currentMySecret = mySecretRef.current;
        const currentOpponentName = opponentNameRef.current;
        const isCorrect = msg.payload.character_id === currentMySecret;
        if (isCorrect) {
          sendStateUpdate('guess_result', { success: true, winner: currentOpponentName });
          setGameState('ended');
          setWinMessage(`لقد فاز ${currentOpponentName}! خمن بنجاح أن شخصيتك هي: ${game.category.characters.find(c => c.id === currentMySecret)?.name_ar}`);
        } else {
          sendStateUpdate('guess_result', { success: false });
          alert(`خمن الخصم بشكل خاطئ! دورك الآن.`);
          setMyTurn(true);
        }
        break;
      case 'guess_result':
        if (msg.payload.success) {
          setGameState('ended');
          setWinMessage('مبروك! لقد فزت باللعبة بتخمين شخصية الخصم بنجاح!');
        } else {
          alert('تخمينك كان خاطئاً! انتهى دورك.');
          setMyTurn(false);
        }
        break;
      case 'pass_turn':
        setMyTurn(true);
        break;
    }
  };

  const toggleEliminate = (id: number) => {
    const newBoard = board.map(c => c.id === id ? { ...c, eliminated: !c.eliminated } : c);
    setBoard(newBoard);
    const remaining = newBoard.filter(c => !c.eliminated).length;
    sendStateUpdate('elimination_update', { remaining });
  };

  const handleChooseSecret = (id: number) => {
    setMySecret(id);
    if (peerConnected) {
      // Peer is already connected — data channel is open, transition immediately.
      sendStateUpdate('select_ready', { id });
      setGameState('playing');
    } else {
      // Peer not yet connected — move to a waiting state; the useEffect above
      // will complete the transition once the peer joins and data channel opens.
      setGameState('selecting');
    }
  };

  const handleGuess = (charId: number, charName: string) => {
    if (!myTurn) {
      alert('ليس دورك حالياً لتخمين الشخصية.');
      return;
    }
    sendStateUpdate('guess', { character_id: charId });
  };

  const handleEndTurn = () => {
    setMyTurn(false);
    sendStateUpdate('pass_turn', {});
  };

  if (loadingJoin) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-background text-foreground p-6 font-sans flex items-center justify-center relative overflow-hidden" dir="rtl">
          {/* Ambient background glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none blur-3xl rounded-full" />
          
          <Head>
            <title>جاري التحقق من الغرفة...</title>
            <meta name="description" content="يرجى الانتظار أثناء جاري الدخول للغرفة والتحقق من توفر مقعد شاغر." />
          </Head>
          <Card className="bg-card/75 backdrop-blur-md border-border text-card-foreground rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative z-10">
            <div className="flex flex-col items-center gap-5">
              <div className="p-4 bg-primary/10 rounded-full border border-primary/20 animate-pulse">
                <Gamepad2 className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <h2 className="text-2xl font-black text-foreground">جاري التحقق من الغرفة...</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                نقوم بالاتصال بخوادم اللعبة والتأكد من توفر مقعد شاغر لك. يرجى الانتظار لحظة.
              </p>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-background text-foreground p-6 font-sans select-none" dir="rtl">
        <Head>
          <title>{`غرفة لعب: ${game.category.name_ar}`}</title>
          <meta name="description" content={`غرفة لعب تفاعلية مباشرة لتخمين شخصيات فئة ${game.category.name_ar} مع خصمك.`} />
        </Head>
        <div className="max-w-6xl mx-auto">
          {/* Style block for 3D flip card animations */}
          <style>{`
            .perspective-1000 {
              perspective: 1000px;
            }
            .preserve-3d {
              transform-style: preserve-3d;
            }
            .backface-hidden {
              backface-visibility: hidden;
              -webkit-backface-visibility: hidden;
            }
            .rotate-y-180 {
              transform: rotateY(180deg);
            }
            @keyframes share-glow {
              0%, 100% {
                box-shadow: 0 0 5px hsl(var(--primary) / 0.4);
                border-color: hsl(var(--primary) / 0.5);
              }
              50% {
                box-shadow: 0 0 20px hsl(var(--primary) / 0.8);
                border-color: hsl(var(--primary));
              }
            }
            .animate-share-glow {
              animation: share-glow 1.5s infinite ease-in-out;
            }
          `}</style>

          {/* Peer Disconnect Banner — non-blocking, dismissible, auto-clears on reconnect */}
          {peerDisconnected && (
            <div className="flex items-center justify-between gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 mb-4 text-sm font-bold">
              <span>انقطع اتصال الخصم. في انتظار إعادة الاتصال...</span>
              <button
                onClick={() => setPeerDisconnected(false)}
                className="text-destructive/60 hover:text-destructive transition shrink-0"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Top Info Panel */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-card border border-border p-4 rounded-xl mb-6 gap-4">
            <div className="flex items-center gap-3">
              <Link href="/guesswho" className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition">
                <ArrowRight className="h-5 w-5" />
              </Link>
              <div>
                <span className="text-muted-foreground text-xs block">الفئة المحددة</span>
                <span className="text-foreground font-bold text-lg">{game.category.name_ar}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                peerConnected 
                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                  : 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse'
              }`}>
                {peerConnected ? `متصل بـ ${opponentName}` : 'بانتظار انضمام الخصم...'}
              </Badge>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('تم نسخ رابط الغرفة إلى الحافظة!');
                }}
                variant={peerConnected ? 'outline' : 'default'}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition font-bold ${
                  !peerConnected 
                    ? 'animate-share-glow bg-primary text-primary-foreground border border-primary hover:bg-primary/95' 
                    : 'border-input'
                }`}
              >
                <Share2 className="h-4 w-4" /> مشاركة الغرفة
              </Button>
            </div>
          </div>

          {/* Selecting screen: secret chosen but waiting for opponent to connect */}
          {gameState === 'selecting' && (
            <Card className="bg-card border-border text-card-foreground rounded-2xl p-8 text-center shadow-xl">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full border border-primary/30 animate-pulse">
                  <Gamepad2 className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-black text-foreground">تم اختيار شخصيتك السرية!</h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                  في انتظار انضمام الخصم إلى الغرفة... شارك رابط الغرفة معه لبدء اللعبة.
                </p>
                <Badge variant="outline" className="px-4 py-2 text-sm font-bold bg-yellow-500/10 text-yellow-600 border-yellow-500/20 animate-pulse">
                  بانتظار الخصم...
                </Badge>
              </div>
            </Card>
          )}

          {/* Lobby screen: Choose secret character */}
          {gameState === 'lobby' && (
            <Card className="bg-card border-border text-card-foreground rounded-2xl p-6 md:p-8 text-center shadow-xl">
              <div className="max-w-2xl mx-auto mb-8 text-center">
                <h2 className="text-3xl font-black text-foreground mb-3 flex items-center justify-center gap-2">
                  <Gamepad2 className="text-primary h-8 w-8" />
                  اختر شخصيتك السرية للبدء
                </h2>
                
                {/* Visual game rule intro cards */}
                <div className="grid sm:grid-cols-2 gap-4 bg-muted/20 border border-border p-4 rounded-2xl text-right text-xs leading-relaxed mt-4">
                  <div className="flex gap-2.5">
                    <div className="h-6 w-6 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center font-bold text-primary shrink-0">١</div>
                    <div>
                      <span className="font-extrabold text-foreground block mb-0.5">ما هي الشخصية السرية؟</span>
                      <p className="text-muted-foreground">هي الشخصية التي سيحاول خصمك تخمينها. اختر بطلاً ذكياً من البطاقات أدناه واضغط عليه لتأكيده كشخصية سرية لك.</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="h-6 w-6 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center font-bold text-primary shrink-0">٢</div>
                    <div>
                      <span className="font-extrabold text-foreground block mb-0.5">كيف تبدأ اللعبة؟</span>
                      <p className="text-muted-foreground">بعد اختيار شخصيتك السرية، وبمجرد أن ينتهي خصمك من اختيار شخصيته السرية أيضاً، ستبدأ المواجهة فوراً وينتقل كليكما إلى لوحة اللعب.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {game.category.characters.map(char => (
                  <CharacterCard
                    key={char.id}
                    char={{ ...char, eliminated: false }}
                    myTurn={myTurn}
                    gameState={gameState}
                    onChooseSecret={handleChooseSecret}
                    onGuess={handleGuess}
                    onToggleEliminate={toggleEliminate}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Main Board view during game */}
          {gameState === 'playing' && (
            <div className="space-y-6">
              {/* Sticky Gameplay Dashboard */}
              <Card className="sticky top-2 z-20 bg-card/90 backdrop-blur-md border-border p-3 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-3">
                {/* Right side (RTL): Secret Character & My Remaining */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                  {mySecret && (
                    <div className="flex items-center gap-2 bg-muted/30 p-1.5 pr-2.5 pl-1.5 rounded-xl border border-border">
                      <span className="text-[10px] text-muted-foreground block font-bold leading-tight">شخصيتك<br/>السرية:</span>
                      {(() => {
                        const s = game.category.characters.find(c => c.id === mySecret);
                        return s ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted border border-primary/20 shrink-0">
                              <img src={`/storage/${s.image_path}`} className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs font-black text-foreground truncate max-w-[80px]">{s.name_ar}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary py-1 px-2.5 text-xs font-black">
                      شخصياتك: {board.filter(c => !c.eliminated).length}
                    </Badge>
                    <Badge variant="outline" className="bg-muted border-border text-muted-foreground py-1 px-2.5 text-xs font-bold">
                      الخصم: {opponentRemaining}
                    </Badge>
                  </div>
                </div>

                {/* Center: Turn Status */}
                <div className="flex items-center gap-2 justify-center py-1.5 px-3 rounded-xl bg-muted/20 border border-border/40 w-full md:w-auto">
                  <span className="text-xs text-muted-foreground">حالة اللعب:</span>
                  <Badge 
                    variant={myTurn ? 'default' : 'secondary'} 
                    className={`font-black py-0.5 px-2.5 text-xs transition-all ${
                      myTurn 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm animate-pulse' 
                        : 'text-muted-foreground'
                    }`}
                  >
                    {myTurn ? 'دورك لطرح الأسئلة والتخمين' : 'انتظر دور الخصم...'}
                  </Badge>
                </div>

                {/* Left side: End Turn Action */}
                <div className="w-full md:w-auto flex justify-end">
                  <Button
                    onClick={handleEndTurn}
                    disabled={!myTurn}
                    className="w-full md:w-auto px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-black rounded-xl text-xs disabled:opacity-40 transition-all shadow-md"
                  >
                    إنهاء دوري وتمريره للخصم
                  </Button>
                </div>
              </Card>

              {/* Spacing Help Panel */}
              <div className="bg-muted/30 p-3 rounded-lg border border-border text-xs text-muted-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>انقر على **استبعاد** لإخفاء شخصية. للتخمين على شخصية الخصم السرية، اضغط على **تخمين الشخصية** وقم بالتأكيد في دورك.</span>
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {board.map(char => (
                  <CharacterCard
                    key={char.id}
                    char={char}
                    myTurn={myTurn}
                    gameState={gameState}
                    onChooseSecret={handleChooseSecret}
                    onGuess={handleGuess}
                    onToggleEliminate={toggleEliminate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ended Screen */}
          {gameState === 'ended' && (
            <Card className="bg-card border-border text-card-foreground rounded-2xl p-12 text-center max-w-xl mx-auto shadow-2xl">
              <h2 className="text-3xl font-black text-foreground mb-4">انتهت اللعبة!</h2>
              <p className="text-primary font-bold text-lg mb-8">{winMessage}</p>
              <Button
                onClick={() => window.location.reload()}
                className="px-6 py-4 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition flex items-center gap-2 mx-auto text-md"
              >
                <RefreshCw className="h-5 w-5" /> العب مجدداً
              </Button>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
