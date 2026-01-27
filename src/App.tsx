
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CardComponent } from './components/CardComponent';
import { Card, GamePhase, GameState, Player, PlayerRole, GameMode, HandType, Move, User } from './types';
import { generateDeck, shuffleDeck, shuffleDeckNoShuffle } from './constants';
import { sortCards, determineHandType, canPlayHand, findMove, findPossibleMoves } from './utils/gameRules';
import { getSmartHint } from './services/geminiService';
import { playTTS, toggleMute, getMuteState } from './services/audioService';

const TELEGRAM_GROUP_LINK = (import.meta as any).env?.VITE_TELEGRAM_GROUP_LINK || "https://t.me/GeminiDouDizhuGroup";
const BOT_USERNAME = (import.meta as any).env?.VITE_BOT_USERNAME || "GeminiDouDizhuBot"; 

// --- Telegram Mock & Init ---
const mockTelegramWebApp = {
  initDataUnsafe: { user: { id: 123456789, first_name: "测试用户", username: "test_user" }, start_param: "" },
  openInvoice: (url: string, callback: (status: string) => void) => {
    if(window.confirm("【模拟支付】点击确定模拟成功")) callback("paid"); else callback("cancelled");
  },
  openTelegramLink: (url: string) => window.open(url, '_blank'),
  showAlert: (message: string) => alert(message),
  ready: () => {},
  expand: () => {},
  viewportStableHeight: window.innerHeight
};

const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return mockTelegramWebApp;
};
const tg = getTelegramWebApp();

// --- Constants ---
const INITIAL_PLAYER_STATE: Player = { id: 0, name: "玩家", hand: [], role: null, isHuman: true, passes: 0, isReady: false };
const INITIAL_GAME_STATE: GameState = {
  deck: [],
  players: [],
  phase: GamePhase.MainMenu,
  mode: GameMode.PvE,
  landlordCards: [],
  currentTurnIndex: 0,
  lastMove: null,
  winnerId: null,
  multiplier: 1,
  baseScore: 100,
  bidsCount: 0
};

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [myPlayerId, setMyPlayerId] = useState<number>(0); // 0, 1, 2 (在好友房中代表座位号)
  
  // UI State
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [aiHint, setAiHint] = useState<string>("");
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [isMatching, setIsMatching] = useState(false); 
  const [isPaying, setIsPaying] = useState(false);
  const [activeModeSelection, setActiveModeSelection] = useState<'pve' | 'friends' | 'match' | null>(null);
  
  // Audio & Orientation
  const [isSoundOn, setIsSoundOn] = useState(!getMuteState());
  const [isPortrait, setIsPortrait] = useState(false);

  // User Data
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // Refs for logic
  const dealingDeckRef = useRef<Card[]>([]);
  const dealingIntervalRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null); // 轮询定时器
  const lastPollTimestamp = useRef<number>(0);

  // --- Initialization ---
  useEffect(() => {
    tg.ready();
    tg.expand();
    
    const checkOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);

    // Initialize User
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
       // Ideally fetch from DB, here we mock init or local state
       const user: User = { 
         telegram_id: tgUser.id, 
         username: tgUser.username || tgUser.first_name, 
         points: 1000, 
         last_check_in_date: null, 
         is_admin: false 
       };
       setCurrentUser(user);
    }

    // Handle Deep Link (Join Room)
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('room_')) {
       // Delay slightly to allow UI to render
       setTimeout(() => handleJoinRoom(startParam), 500);
    }

    return () => {
        window.removeEventListener('resize', checkOrientation);
        stopPolling();
    };
  }, []);

  // --- Network Logic (Polling) ---

  const stopPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
  };

  const startPolling = (roomId: string) => {
      stopPolling();
      // Poll every 1.5 seconds
      pollIntervalRef.current = window.setInterval(async () => {
          try {
              const res = await fetch('/api/game/sync', {
                  method: 'POST',
                  body: JSON.stringify({ action: 'poll', roomId })
              });
              const data = await res.json();
              if (data.success && data.state) {
                  // Only update if timestamp is newer (simple optimistic concurrency control)
                  // Or just always update for simplicity in this demo
                  if (data.timestamp > lastPollTimestamp.current) {
                      lastPollTimestamp.current = data.timestamp;
                      setGameState(data.state);
                      
                      // Check if game just started (Dealing) to trigger animation
                      // This part is tricky with polling, let's keep it simple: 
                      // If phase changed to DEALING locally, we might need to handle deck locally?
                      // For now, assume state.players already has hands sorted by server/host.
                  }
              }
          } catch (e) {
              console.error("Polling error", e);
          }
      }, 1500);
  };

  const uploadGameState = async (newState: GameState) => {
      // Optimistic Update
      setGameState(newState);
      
      if (gameState.mode === GameMode.Friends && gameState.roomId) {
          try {
              await fetch('/api/game/sync', {
                  method: 'POST',
                  body: JSON.stringify({
                      action: 'update',
                      roomId: gameState.roomId,
                      payload: { newState }
                  })
              });
          } catch (e) {
              tg.showAlert("同步失败，请检查网络");
          }
      }
  };

  // --- Room Actions ---

  const handleCreateRoom = async () => {
      if (!currentUser) return;
      setIsMatching(true); // Loading spinner
      const roomId = `room_${Math.floor(Math.random() * 89999) + 10000}`;
      
      try {
          const res = await fetch('/api/game/sync', {
              method: 'POST',
              body: JSON.stringify({
                  action: 'create',
                  roomId,
                  userId: currentUser.telegram_id,
                  username: currentUser.username
              })
          });
          const data = await res.json();
          if (data.success) {
              const newState = { ...data.state, roomId, mode: GameMode.Friends };
              setGameState(newState);
              setMyPlayerId(0); // Host is always 0
              startPolling(roomId);
          } else {
              tg.showAlert("创建房间失败");
          }
      } catch (e) {
          tg.showAlert("网络错误");
      } finally {
          setIsMatching(false);
          setActiveModeSelection(null);
      }
  };

  const handleJoinRoom = async (roomId: string) => {
      if (!currentUser) return;
      setIsMatching(true);
      
      try {
          const res = await fetch('/api/game/sync', {
              method: 'POST',
              body: JSON.stringify({
                  action: 'join',
                  roomId,
                  userId: currentUser.telegram_id,
                  username: currentUser.username
              })
          });
          const data = await res.json();
          if (data.success) {
              setMyPlayerId(data.playerId); // Set my seat index
              // Immediately poll to get current state
              const pollRes = await fetch('/api/game/sync', {
                   method: 'POST',
                   body: JSON.stringify({ action: 'poll', roomId })
              });
              const pollData = await pollRes.json();
              if (pollData.success) {
                  setGameState({ ...pollData.state, roomId, mode: GameMode.Friends });
                  startPolling(roomId);
              }
          } else {
              tg.showAlert(data.error || "加入失败");
          }
      } catch (e) {
          tg.showAlert("网络错误");
      } finally {
          setIsMatching(false);
      }
  };

  // Check if everyone is ready to start (Host only triggers)
  useEffect(() => {
    if (gameState.mode === GameMode.Friends && gameState.phase === GamePhase.RoomLobby && myPlayerId === 0) {
        const readyCount = gameState.players.filter(p => p.isReady).length;
        if (readyCount === 3) {
            // Host triggers game start
            startFriendGameDealing();
        }
    }
  }, [gameState.players, gameState.phase, gameState.mode]);

  const startFriendGameDealing = () => {
      // Logic similar to PvE but uploads state
      const fullDeck = generateDeck();
      const deck = shuffleDeck(fullDeck);
      const leftovers = deck.splice(deck.length - 3, 3);
      
      const p0Hand = sortCards(deck.slice(0, 17));
      const p1Hand = sortCards(deck.slice(17, 34));
      const p2Hand = sortCards(deck.slice(34, 51));

      const newPlayers = [...gameState.players];
      newPlayers[0].hand = p0Hand;
      newPlayers[1].hand = p1Hand;
      newPlayers[2].hand = p2Hand;

      const newState: GameState = {
          ...gameState,
          phase: GamePhase.Bidding, // Skip animation for network simplicity, jump to Bidding
          players: newPlayers,
          landlordCards: leftovers,
          currentTurnIndex: Math.floor(Math.random() * 3),
          bidsCount: 0
      };
      
      playTTS("开始抢地主", "Aoede");
      uploadGameState(newState);
  };

  // --- Local PvE Logic ---
  const startPvEGame = (isNoShuffle: boolean) => {
      const fullDeck = generateDeck();
      const deck = isNoShuffle ? shuffleDeckNoShuffle(fullDeck) : shuffleDeck(fullDeck);
      dealingDeckRef.current = [...deck];
      const leftovers = dealingDeckRef.current.splice(dealingDeckRef.current.length - 3, 3);
      
      const myName = currentUser?.username || "我";
      const newPlayers: Player[] = [
          { ...INITIAL_PLAYER_STATE, id: 0, name: myName, isHuman: true, hand: [] },
          { ...INITIAL_PLAYER_STATE, id: 1, name: "电脑 (左)", isHuman: false, hand: [] },
          { ...INITIAL_PLAYER_STATE, id: 2, name: "电脑 (右)", isHuman: false, hand: [] }
      ];

      setGameState({
          ...INITIAL_GAME_STATE,
          mode: GameMode.PvE,
          players: newPlayers,
          landlordCards: leftovers,
          phase: GamePhase.Dealing,
          currentTurnIndex: 0,
      });
      setActiveModeSelection(null);
  };

  // Animation for PvE Dealing
  useEffect(() => {
      if (gameState.mode === GameMode.PvE && gameState.phase === GamePhase.Dealing) {
        let cardIndex = 0;
        const totalCardsToDeal = 51; 
        dealingIntervalRef.current = window.setInterval(() => {
            if (cardIndex >= totalCardsToDeal) {
                if (dealingIntervalRef.current) clearInterval(dealingIntervalRef.current);
                setGameState(prev => ({
                    ...prev,
                    phase: GamePhase.Bidding,
                    players: prev.players.map(p => ({...p, hand: sortCards(p.hand)}))
                }));
                playTTS("开始抢地主", "Aoede");
                return;
            }
            const cardToDeal = dealingDeckRef.current[cardIndex];
            const playerToReceive = cardIndex % 3;
            setGameState(prev => {
                const updatedPlayers = [...prev.players];
                updatedPlayers[playerToReceive] = {
                    ...updatedPlayers[playerToReceive],
                    hand: [...updatedPlayers[playerToReceive].hand, cardToDeal]
                };
                return { ...prev, players: updatedPlayers };
            });
            cardIndex++;
        }, 30);
        return () => { if (dealingIntervalRef.current) clearInterval(dealingIntervalRef.current); };
      }
  }, [gameState.phase, gameState.mode]);


  // --- Game Action Handlers (Unified) ---

  const handleBid = (claim: boolean) => {
    // Only allow current turn player to act
    if (gameState.currentTurnIndex !== myPlayerId && gameState.mode === GameMode.Friends) return;

    const currentPlayerIdx = gameState.currentTurnIndex;
    const voice = currentPlayerIdx === 0 ? 'Aoede' : (currentPlayerIdx === 1 ? 'Puck' : 'Kore');
    playTTS(claim ? "叫地主!" : "不叫", voice);

    let newState = { ...gameState };

    if (claim) {
      const newPlayers = [...newState.players];
      newPlayers.forEach((p, idx) => p.role = idx === currentPlayerIdx ? PlayerRole.Landlord : PlayerRole.Peasant);
      newPlayers[currentPlayerIdx].hand = sortCards([...newPlayers[currentPlayerIdx].hand, ...newState.landlordCards]);

      newState.players = newPlayers;
      newState.phase = GamePhase.Playing;
      newState.lastMove = null;
    } else {
      const nextTurn = (newState.currentTurnIndex + 1) % 3;
      if (newState.bidsCount + 1 >= 3) {
        // All passed, simple restart for PvE, logic for Friends?
        // For simplicity, just force the 3rd guy to take it or restart
        tg.showAlert("流局，强制重新发牌");
        if (gameState.mode === GameMode.Friends) startFriendGameDealing();
        else startPvEGame(false);
        return;
      } else {
        newState.currentTurnIndex = nextTurn;
        newState.bidsCount += 1;
      }
    }

    if (gameState.mode === GameMode.Friends) uploadGameState(newState);
    else setGameState(newState);
  };

  const playTurn = (cardsToPlay: Card[]) => {
      const currentPlayerIdx = gameState.currentTurnIndex;
      const handInfo = determineHandType(cardsToPlay);
      let isValid = false;

      const isLeader = !gameState.lastMove || gameState.lastMove.playerId === currentPlayerIdx;
      
      if (cardsToPlay.length === 0) {
          if (!isLeader) isValid = true; 
      } else {
          if (handInfo.type !== HandType.Invalid) {
              if (isLeader) isValid = true;
              else if (gameState.lastMove) {
                  const lastValue = determineHandType(gameState.lastMove.cards).value;
                  isValid = canPlayHand(cardsToPlay, gameState.lastMove.cards, gameState.lastMove.type, lastValue);
              }
          }
      }

      if (!isValid) {
          tg.showAlert("出牌不符合规则");
          return;
      }

      // Execute Move
      let newState = { ...gameState };
      let newMult = newState.multiplier;
      if (handInfo.type === HandType.Bomb) newMult *= 2;
      if (handInfo.type === HandType.Rocket) newMult *= 2;

      // Play sound
      const voice = currentPlayerIdx === 0 ? 'Aoede' : (currentPlayerIdx === 1 ? 'Puck' : 'Kore');
      if (cardsToPlay.length > 0) playTTS(handInfo.type === HandType.Single ? cardsToPlay[0].label : handInfo.type, voice);
      else playTTS("不要", voice);

      const newPlayers = [...newState.players];
      const player = newPlayers[currentPlayerIdx];
      
      if (cardsToPlay.length > 0) {
          const playedIds = new Set(cardsToPlay.map(c => c.id));
          player.hand = player.hand.filter(c => !playedIds.has(c.id));
          player.passes = 0;
      } else {
          player.passes += 1;
      }

      // Check Win
      if (player.hand.length === 0) {
          newState.phase = GamePhase.GameOver;
          newState.winnerId = currentPlayerIdx;
          newState.multiplier = newMult;
          newState.lastMove = { playerId: currentPlayerIdx, cards: cardsToPlay, type: handInfo.type };
          playTTS("游戏结束", "Aoede");
      } else {
          newState.players = newPlayers;
          newState.multiplier = newMult;
          newState.lastMove = cardsToPlay.length > 0 ? { playerId: currentPlayerIdx, cards: cardsToPlay, type: handInfo.type } : newState.lastMove;
          newState.currentTurnIndex = (newState.currentTurnIndex + 1) % 3;
      }

      setSelectedCardIds([]);
      setAiHint("");

      if (gameState.mode === GameMode.Friends) uploadGameState(newState);
      else setGameState(newState);
  };

  // --- Bot Logic (PvE only) ---
  useEffect(() => {
    if (gameState.mode !== GameMode.PvE) return; // Friends mode relies on real humans
    if (gameState.phase !== GamePhase.Playing && gameState.phase !== GamePhase.Bidding) return;
    
    const player = gameState.players[gameState.currentTurnIndex];
    if (player.isHuman) return;

    const timer = setTimeout(() => {
        if (gameState.phase === GamePhase.Bidding) {
            handleBid(Math.random() < 0.4);
        } else {
            const isLeader = !gameState.lastMove || gameState.lastMove.playerId === player.id;
            const lastCards = isLeader ? null : gameState.lastMove?.cards || null;
            const move = findMove(player.hand, lastCards);
            playTurn(move || []);
        }
    }, 1200);
    return () => clearTimeout(timer);
  }, [gameState, gameState.currentTurnIndex]);


  // --- Helper Functions ---
  const handleDailyCheckIn = () => {
      if(!currentUser) return;
      const today = new Date().toISOString().split('T')[0];
      setCurrentUser({ ...currentUser, points: currentUser.points + 1000, last_check_in_date: today });
      setHasCheckedInToday(true);
      tg.showAlert("签到成功 +1000");
  };

  const handleShareRoom = () => {
      const inviteLink = `https://t.me/${BOT_USERNAME}/app?startapp=${gameState.roomId}`;
      const text = `三缺一！房间号：${gameState.roomId}，点击链接加入！`;
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`);
  };

  const requestHint = async () => {
      setIsGettingHint(true);
      // Pass my hand (always player[myPlayerId] in friends mode, or player[0] in PvE)
      const myHand = gameState.players[myPlayerId].hand;
      const hint = await getSmartHint(myHand, gameState.lastMove, gameState.landlordCards, gameState.players[myPlayerId].role || "农民");
      setAiHint(hint);
      setIsGettingHint(false);
  };
  
  const toggleCardSelection = (cardId: string) => {
      // Only allow selection if it's my turn
      if (gameState.phase !== GamePhase.Playing || gameState.currentTurnIndex !== myPlayerId) return;
      setSelectedCardIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
  };

  const handleHumanPlay = () => {
      const myHand = gameState.players[myPlayerId].hand;
      const cards = myHand.filter(c => selectedCardIds.includes(c.id));
      playTurn(sortCards(cards));
  };


  // --- RENDERERS ---

  const renderLobby = () => (
      <div className="h-[100dvh] w-full flex flex-col items-center p-4 bg-gradient-to-br from-green-900 to-green-800 text-white overflow-y-auto relative pb-20">
          {/* Top Bar */}
          <div className="w-full flex justify-between items-center p-2 mb-4 bg-black/20 rounded-xl">
             <div className="flex gap-2 items-center">
                <span className="text-xl">💰</span>
                <span className="text-yellow-300 font-bold">{currentUser?.points || 0}</span>
                <button onClick={handleDailyCheckIn} disabled={hasCheckedInToday} className="px-2 py-1 bg-green-600 rounded text-xs ml-2">{hasCheckedInToday?'已签到':'+1000'}</button>
             </div>
             <button onClick={() => setIsSoundOn(!isSoundOn)}>{isSoundOn ? '🔊' : '🔇'}</button>
          </div>

          <div className="w-full flex gap-2 justify-center mb-6">
             <button onClick={() => tg.showAlert("请前往 Bot 聊天窗口支付")} className="bg-yellow-600 px-4 py-2 rounded-full font-bold shadow text-sm">🛒 购买积分</button>
             <button onClick={() => tg.openTelegramLink(TELEGRAM_GROUP_LINK)} className="bg-blue-600 px-4 py-2 rounded-full font-bold shadow text-sm">👥 加入群组</button>
          </div>

          <div className="text-center mt-2 mb-8">
             <h1 className="text-5xl font-bold text-yellow-400 drop-shadow-lg">Gemini 斗地主</h1>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-sm z-10">
             <button onClick={() => startPvEGame(false)} className="h-28 bg-blue-800 rounded-2xl border-4 border-blue-500 flex flex-col items-center justify-center shadow-xl active:scale-95">
                 <span className="text-3xl mb-1">🤖</span>
                 <span className="text-xl font-bold">人机对战</span>
             </button>
             <button onClick={handleCreateRoom} className="h-28 bg-purple-800 rounded-2xl border-4 border-purple-500 flex flex-col items-center justify-center shadow-xl active:scale-95">
                 <span className="text-3xl mb-1">🤝</span>
                 <span className="text-xl font-bold">好友约战 (真实联机)</span>
                 <span className="text-xs text-purple-200">创建房间 / 邀请链接</span>
             </button>
             <button onClick={() => tg.showAlert("匹配功能暂未开放，请使用好友约战")} className="h-28 bg-orange-800 rounded-2xl border-4 border-orange-500 flex flex-col items-center justify-center shadow-xl active:scale-95 opacity-80">
                 <span className="text-3xl mb-1">⚡</span>
                 <span className="text-xl font-bold">自动匹配</span>
             </button>
          </div>
      </div>
  );

  const renderRoomLobby = () => (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <h2 className="text-2xl font-bold text-yellow-400 mb-2">好友房间</h2>
          <div className="bg-black/40 px-4 py-2 rounded-full font-mono mb-8 text-lg select-text">ID: {gameState.roomId}</div>
          
          <div className="flex gap-4 mb-8">
             {gameState.players.map((p, idx) => (
                 <div key={idx} className={`w-24 h-32 border-2 rounded-xl flex flex-col items-center justify-center ${p.isReady ? 'border-green-500 bg-green-900/30' : 'border-gray-600 border-dashed'}`}>
                     <div className="text-3xl mb-2">{p.isReady ? '👤' : '?'}</div>
                     <div className="text-xs text-center px-1 truncate w-full">{p.name}</div>
                     <div className={`text-[10px] mt-1 ${p.isReady ? 'text-green-400' : 'text-gray-400'}`}>{p.isReady ? '已准备' : '等待中'}</div>
                 </div>
             ))}
          </div>
          
          <div className="space-y-4 w-full max-w-xs">
              <button onClick={handleShareRoom} className="bg-blue-600 w-full py-3 rounded-full font-bold shadow-lg flex items-center justify-center gap-2">
                  <span>📤</span> 发送邀请给好友
              </button>
              <div className="text-center text-sm text-gray-400">人满后由房主自动开始</div>
              <button onClick={() => { stopPolling(); setGameState(INITIAL_GAME_STATE); }} className="text-gray-400 underline text-sm w-full text-center">退出房间</button>
          </div>
      </div>
  );

  // --- Game Board Render ---
  
  // Calculate relative positions based on myPlayerId
  // My seat is always bottom. 
  // If I am 0: Left=1, Right=2
  // If I am 1: Left=2, Right=0
  // If I am 2: Left=0, Right=1
  const getRelativePlayer = (offset: number) => {
      const idx = (myPlayerId + offset) % 3;
      return gameState.players[idx];
  };

  const renderGame = () => {
      const pMe = gameState.players[myPlayerId];
      const pRight = getRelativePlayer(1);
      const pLeft = getRelativePlayer(2);

      const getLastCards = (pid: number) => gameState.lastMove?.playerId === pid ? gameState.lastMove.cards : null;

      const landscapeStyle: React.CSSProperties = isPortrait ? {
          transform: 'rotate(90deg)', transformOrigin: 'bottom left', position: 'absolute', top: '-100vw', left: '0', height: '100vw', width: '100vh', overflow: 'hidden'
      } : { height: '100%', width: '100%', overflow: 'hidden' };

      return (
        <div style={landscapeStyle} className="bg-[#1a472a] relative flex flex-col select-none">
            {/* Header */}
            <div className="h-12 flex justify-between items-center px-4 bg-black/20 z-20 shrink-0">
                <div className="flex gap-2">
                   {gameState.landlordCards.map((c, i) => <CardComponent key={c ? c.id : i} card={c} small hidden={gameState.phase === GamePhase.Dealing || gameState.phase === GamePhase.Bidding} />)}
                </div>
                <div className="text-white text-xs bg-black/40 px-3 py-1 rounded-full">倍数: {gameState.multiplier}</div>
                <button onClick={() => { stopPolling(); setGameState(INITIAL_GAME_STATE); }} className="text-xs bg-red-900/80 px-3 py-1 rounded border border-red-500">退出</button>
            </div>

            {/* Main Table */}
            <div className="flex-1 relative w-full">
                
                {/* Left Opponent */}
                <div className="absolute left-0 top-8 w-24 flex flex-col items-start pl-2 z-10">
                    <div className={`flex flex-col items-center bg-black/30 p-2 rounded-r-xl border-l-4 ${gameState.currentTurnIndex === pLeft.id ? 'border-yellow-400' : 'border-transparent'}`}>
                        <div className="text-2xl">👤</div>
                        <div className="text-xs text-white truncate w-16 text-center">{pLeft.name}</div>
                        <div className="text-[10px] text-yellow-300">{pLeft.role === PlayerRole.Landlord ? '👑 地主' : '农民'}</div>
                        <div className="bg-black/50 px-2 rounded text-white text-xs">{pLeft.hand.length}</div>
                    </div>
                    {getLastCards(pLeft.id) ? (
                        <div className="absolute left-24 top-0 ml-2 scale-75 origin-left flex bg-black/20 p-1 rounded">{getLastCards(pLeft.id)!.map(c => <CardComponent key={c.id} card={c} small />)}</div>
                    ) : (gameState.players[pLeft.id].passes > 0 && gameState.lastMove?.playerId !== pLeft.id && <div className="absolute left-24 top-8 ml-2 text-gray-300 font-bold">不出</div>)}
                </div>

                {/* Right Opponent */}
                <div className="absolute right-0 top-8 w-24 flex flex-col items-end pr-2 z-10">
                    <div className={`flex flex-col items-center bg-black/30 p-2 rounded-l-xl border-r-4 ${gameState.currentTurnIndex === pRight.id ? 'border-yellow-400' : 'border-transparent'}`}>
                        <div className="text-2xl">👤</div>
                        <div className="text-xs text-white truncate w-16 text-center">{pRight.name}</div>
                        <div className="text-[10px] text-yellow-300">{pRight.role === PlayerRole.Landlord ? '👑 地主' : '农民'}</div>
                        <div className="bg-black/50 px-2 rounded text-white text-xs">{pRight.hand.length}</div>
                    </div>
                     {getLastCards(pRight.id) ? (
                        <div className="absolute right-24 top-0 mr-2 scale-75 origin-right flex bg-black/20 p-1 rounded">{getLastCards(pRight.id)!.map(c => <CardComponent key={c.id} card={c} small />)}</div>
                    ) : (gameState.players[pRight.id].passes > 0 && gameState.lastMove?.playerId !== pRight.id && <div className="absolute right-24 top-8 mr-2 text-gray-300 font-bold">不出</div>)}
                </div>

                {/* My Last Cards (Center) */}
                {getLastCards(pMe.id) && (
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0">
                         <div className="flex bg-black/20 p-2 rounded-xl">{getLastCards(pMe.id)!.map(c => <CardComponent key={c.id} card={c} small />)}</div>
                    </div>
                )}
                 {gameState.players[pMe.id].passes > 0 && gameState.lastMove?.playerId !== pMe.id && <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-300 font-bold text-3xl">不出</div>}

                 {/* Notifications */}
                 <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                    <div className="pointer-events-auto">
                    {gameState.phase === GamePhase.GameOver && (
                        <div className="bg-black/90 p-8 rounded-xl border-2 border-yellow-500 text-center shadow-2xl">
                           <h2 className="text-5xl font-bold text-white mb-4">{gameState.winnerId === myPlayerId ? "🎉 胜利!" : "😢 失败"}</h2>
                           <div className="flex gap-4 mt-6">
                               <button onClick={() => { stopPolling(); setGameState(INITIAL_GAME_STATE); }} className="bg-gray-600 px-6 py-2 rounded-full font-bold text-white">返回大厅</button>
                           </div>
                        </div>
                    )}
                    {gameState.phase === GamePhase.Bidding && gameState.currentTurnIndex === myPlayerId && (
                        <div className="flex gap-6">
                            <button onClick={() => handleBid(true)} className="bg-orange-500 text-white font-bold py-3 px-8 rounded-full shadow-lg">叫地主</button>
                            <button onClick={() => handleBid(false)} className="bg-gray-600 text-white font-bold py-3 px-8 rounded-full shadow-lg">不叫</button>
                        </div>
                    )}
                    </div>
                 </div>
            </div>

            {/* Bottom Area (My Hand & Controls) */}
            <div className="h-56 w-full flex flex-col justify-end relative z-10 pb-2 shrink-0">
                <div className="h-12 w-full flex justify-center items-center gap-4 mb-2">
                    {gameState.phase === GamePhase.Playing && gameState.currentTurnIndex === myPlayerId && (
                        <>
                           <button onClick={() => playTurn([])} disabled={!gameState.lastMove || gameState.lastMove.playerId === myPlayerId} className={`px-6 py-2 rounded-full font-bold ${(!gameState.lastMove || gameState.lastMove.playerId === myPlayerId) ? 'bg-gray-600 opacity-50' : 'bg-red-600 text-white'}`}>不出</button>
                           <button onClick={requestHint} className="bg-purple-600 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-1 text-sm">{isGettingHint ? '...' : 'AI提示'}</button>
                           <button onClick={handleHumanPlay} className="bg-green-600 text-white px-10 py-2 rounded-full font-bold shadow-lg text-lg">出牌</button>
                        </>
                    )}
                </div>

                {aiHint && <div className="absolute bottom-48 left-1/2 transform -translate-x-1/2 bg-purple-900/90 text-purple-100 p-2 rounded text-sm z-30 border border-purple-500">{aiHint}</div>}

                <div className="w-full flex justify-center items-end h-40 overflow-visible relative">
                    <div className="flex items-end px-4">
                        {pMe.hand.map((card, idx) => (
                             <div key={card.id} className="transition-all duration-100 origin-bottom" style={{ marginLeft: idx === 0 ? 0 : `-35px`, zIndex: idx }}>
                                 <CardComponent card={card} selected={selectedCardIds.includes(card.id)} onClick={() => toggleCardSelection(card.id)} />
                             </div>
                        ))}
                    </div>
                </div>
                <div className="absolute bottom-2 left-4 bg-black/40 px-3 py-1 rounded text-sm text-yellow-300 font-bold border border-yellow-500/30">
                    {pMe.role === PlayerRole.Landlord ? '👑' : '👨‍🌾'} {pMe.name} (我)
                </div>
            </div>
        </div>
      );
  };

  if (gameState.phase === GamePhase.MainMenu) return renderLobby();
  if (gameState.phase === GamePhase.RoomLobby) return renderRoomLobby();
  if (isMatching) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center z-50">加载中...</div>;

  return renderGame();
};

export default App;
