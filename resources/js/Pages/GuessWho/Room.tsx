import React, { useEffect, useState, useRef } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Share2, RefreshCw, HelpCircle, ArrowRight, X, Check, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import axios from 'axios';

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
  const [sessionUuid] = useState(() => {
    let uuid = localStorage.getItem('guess_who_session_id');
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('guess_who_session_id', uuid);
    }
    return uuid;
  });
  
  // Game States
  const [peerConnected, setPeerConnected] = useState(false);
  const [gameState, setGameState] = useState<'lobby' | 'selecting' | 'playing' | 'ended'>('lobby');
  const [board, setBoard] = useState<(Character & { eliminated: boolean })[]>([]);
  const [mySecret, setMySecret] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState('الخصم');
  const [opponentRemaining, setOpponentRemaining] = useState(game.category.characters.length);
  const [peerUuid, setPeerUuid] = useState<string | null>(null);
  const [myTurn, setMyTurn] = useState(false);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  // WebRTC Refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  // Initialize board characters
  useEffect(() => {
    const items = game.category.characters.map(c => ({ ...c, eliminated: false }));
    // Shuffle board locally
    setBoard([...items].sort(() => Math.random() - 0.5));
  }, [game]);

  // Configure WebRTC and Laravel Echo listeners
  useEffect(() => {
    if (!window.Echo) {
      console.warn('Laravel Echo is not configured. Broadcasting won\'t work.');
      return;
    }

    const channelName = `guesswho.${game.room_code}`;
    const channel = window.Echo.join(channelName)
      .here((users: any[]) => {
        const other = users.find(u => u.session_id !== sessionUuid);
        if (other) {
          setPeerUuid(other.session_id);
          setOpponentName(other.name || 'لاعب آخر');
          initiateCall(other.session_id);
        }
      })
      .joining((user: any) => {
        setPeerUuid(user.session_id);
        setOpponentName(user.name || 'لاعب آخر');
        initiateCall(user.session_id);
      })
      .leaving((user: any) => {
        if (user.session_id === peerUuid) {
          setPeerConnected(false);
          alert('انقطع اتصال الخصم.');
        }
      })
      .listen('.signal', (e: any) => {
        if (e.targetSession === sessionUuid) {
          handleSignal(e);
        }
      });

    return () => {
      window.Echo.leave(channelName);
      peerConnection.current?.close();
    };
  }, [peerUuid]);

  // Setup Peer Connection
  const createPeerConnection = (targetSession: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(targetSession, 'candidate', event.candidate);
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
      const isPlayer1 = sessionUuid < (peerUuid || '');
      setMyTurn(isPlayer1);
    };
    channel.onclose = () => setPeerConnected(false);
    channel.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      handlePeerMessage(msg);
    };
  };

  const initiateCall = async (targetSession: string) => {
    const pc = createPeerConnection(targetSession);
    const dc = pc.createDataChannel('game_sync');
    setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(targetSession, 'offer', offer);
  };

  const handleSignal = async (e: any) => {
    const pc = peerConnection.current || createPeerConnection(e.senderSession);

    if (e.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(e.data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(e.senderSession, 'answer', answer);
    } else if (e.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(e.data));
    } else if (e.type === 'candidate') {
      await pc.addIceCandidate(new RTCIceCandidate(e.data));
    }
  };

  const sendSignal = async (targetSession: string, type: string, data: any) => {
    try {
      await axios.post(`/guesswho/room/${game.room_code}/signal`, {
        target_session: targetSession,
        sender_session: sessionUuid,
        type,
        data
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
        const isCorrect = msg.payload.character_id === mySecret;
        if (isCorrect) {
          sendStateUpdate('guess_result', { success: true, winner: opponentName });
          setGameState('ended');
          setWinMessage(`لقد فاز ${opponentName}! خمن بنجاح أن شخصيتك هي: ${game.category.characters.find(c => c.id === mySecret)?.name_ar}`);
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
    sendStateUpdate('select_ready', { id });
    setGameState('playing');
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

  return (
    <MainLayout>
      <div className="min-h-screen bg-background text-foreground p-6 font-sans select-none" dir="rtl">
        <Head title={`الغرفة: ${game.category.name_ar}`} />
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
