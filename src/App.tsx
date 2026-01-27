import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CardComponent } from './components/CardComponent';
import { Card, GamePhase, GameState, Player, PlayerRole, Suit, Rank, HandType, Move, User } from './types';
import { generateDeck, shuffleDeck, shuffleDeckNoShuffle } from './constants';
import { sortCards, determineHandType, canPlayHand, findMove } from './utils/gameRules';
import { getSmartHint } from './services/geminiService';
import { playTTS, toggleMute, getMuteState } from './services/audioService';

// 配置群组链接 (优先使用环境变量，否则使用默认)
const TELEGRAM_GROUP_LINK = (import.meta as any).env?.VITE_TELEGRAM_GROUP_LINK || "https://t.me/GeminiDouDizhuGroup";

// 模拟 Telegram WebApp 接口 (仅在开发环境或 SDK 加载失败时使用)
const mockTelegramWebApp = {
  initDataUnsafe: {
    user: {
      id: 123456789,
      first_name: "测试用户",
      username: "test_user"
    }
  },
  openInvoice: (url: string, callback: (status: string) => void) => {
    console.log("Mock Payment for URL:", url);
    // 模拟支付成功
    const confirmed = window.confirm("【模拟模式】这是本地模拟支付，点击确定模拟支付成功（不扣费），点击取消模拟失败。");
    if (confirmed) {
       setTimeout(() => callback("paid"), 1000);
    } else {
       callback("cancelled");
    }
  },
  openTelegramLink: (url: string) => {
    window.open(url, '_blank');
  },
  showAlert: (message: string) => alert(message),
  ready: () => {}
};

// 获取 Telegram 对象 (优先使用 window.Telegram.WebApp)
const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return mockTelegramWebApp;
};

const tg = getTelegramWebApp();

// Initial state
const INITIAL_PLAYER_STATE: Player = {
  id: 0,
  name: "玩家",
  hand: [],
  role: null,
  isHuman: true,
  passes: 0
};

const INITIAL_GAME_STATE: GameState = {
  deck: [],
  players: [
    { ...INITIAL_PLAYER_STATE, id: 0, name: "我" },
    { ...INITIAL_PLAYER_STATE, id: 1, name: "电脑 (左)", isHuman: false },
    { ...INITIAL_PLAYER_STATE, id: 2, name: "电脑 (右)", isHuman: false }
  ],
  phase: GamePhase.MainMenu,
  landlordCards: [],
  currentTurnIndex: 0,
  lastMove: null,
  winnerId: null,
  multiplier: 1,
  baseScore: 100,
  bidsCount: 0
};

// Mock 数据库 (用于前端演示)
const MOCK_DB_USERS: User[] = [
  { telegram_id: 123456789, username: "test_user", points: 10000, last_check_in_date: null, is_admin: true }, // 我 (管理员)
  { telegram_id: 987654321, username: "player_two", points: 500, last_check_in_date: "2023-10-01", is_admin: false },
  { telegram_id: 112233445, username: "bot_hater", points: 0, last_check_in_date: null, is_admin: false },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [aiHint, setAiHint] = useState<string>("");
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [isMatching, setIsMatching] = useState(false); 
  const [isPaying, setIsPaying] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  
  // Audio State
  const [isSoundOn, setIsSoundOn] = useState(!getMuteState());

  // User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  
  // UI State
  const [activeModeSelection, setActiveModeSelection] = useState<'pve' | 'friends' | 'match' | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUserList, setAdminUserList] = useState<User[]>(MOCK_DB_USERS); // Admin only

  // Dealing Animation Refs
  const dealingDeckRef = useRef<Card[]>([]);
  const dealingIntervalRef = useRef<number | null>(null);

  // 初始化 Telegram WebApp 用户
  useEffect(() => {
    tg.ready();
    
    // 检测是否运行在 Mock 模式
    if (!(window as any).Telegram?.WebApp) {
        setIsMockMode(true);
        console.warn("Telegram WebApp SDK not found. Running in Mock Mode.");
    }

    const tgUser = tg.initDataUnsafe?.user;
    
    if (tgUser) {
      const existingUser = adminUserList.find(u => u.telegram_id === tgUser.id);
      
      if (existingUser) {
        setCurrentUser(existingUser);
        checkIfCheckedIn(existingUser.last_check_in_date);
      } else {
        const newUser: User = {
          telegram_id: tgUser.id,
          username: tgUser.username || tgUser.first_name,
          points: 1000, 
          last_check_in_date: null,
          is_admin: false 
        };
        setAdminUserList(prev => [...prev, newUser]);
        setCurrentUser(newUser);
        tg.showAlert("欢迎新玩家！已赠送 1000 积分！");
      }
    }
  }, []);

  const checkIfCheckedIn = (lastDate: string | null) => {
    if (!lastDate) {
      setHasCheckedInToday(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    setHasCheckedInToday(lastDate === today);
  };

  const handleDailyCheckIn = () => {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const updatedUser = { 
      ...currentUser, 
      points: currentUser.points + 1000, 
      last_check_in_date: today 
    };
    setCurrentUser(updatedUser);
    setHasCheckedInToday(true);
    setAdminUserList(prev => prev.map(u => u.telegram_id === currentUser.telegram_id ? updatedUser : u));
    tg.showAlert("签到成功！获得 1000 积分！");
  };

  const handleToggleSound = () => {
    const isMuted = toggleMute();
    setIsSoundOn(!isMuted);
  };

  const handleBuyStars = async () => {
    if (isPaying) return;
    setIsPaying(true);
    
    // 如果是模拟模式，直接提示
    if (isMockMode) {
        const confirmed = window.confirm("【模拟模式】当前不在 Telegram 环境，将进行模拟支付（不扣费）。是否继续？");
        if (!confirmed) {
            setIsPaying(false);
            return;
        }
    }

    try {
      const response = await fetch('/api/create-invoice', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok || !data.invoiceLink) {
          throw new Error(data.error || "Failed to create invoice");
      }

      // 如果是在真正的 Telegram 环境中，openInvoice 会唤起原生支付弹窗
      // 如果是在浏览器中，会使用上面的 mockTelegramWebApp，直接回调成功
      tg.openInvoice(data.invoiceLink, (status: string) => {
         setIsPaying(false);
         if (status === "paid") {
            const pointsAmount = 2000;
            if (currentUser) {
                const updatedUser = { ...currentUser, points: currentUser.points + pointsAmount };
                setCurrentUser(updatedUser);
                setAdminUserList(prev => prev.map(u => u.telegram_id === currentUser.telegram_id ? updatedUser : u));
                
                if (isMockMode) {
                    tg.showAlert(`【模拟】支付成功！获得 ${pointsAmount} 积分。`);
                } else {
                    tg.showAlert(`支付成功！获得 ${pointsAmount} 积分。`);
                }
            }
         } else if (status === "cancelled") {
            // 用户取消支付
         } else {
            tg.showAlert("支付状态异常: " + status);
         }
      });
    } catch (e: any) {
      setIsPaying(false);
      tg.showAlert("生成订单失败: " + e.message);
    }
  };

  const handleOpenGroup = () => {
    tg.openTelegramLink(TELEGRAM_GROUP_LINK);
  };

  const handleDeleteUser = (targetId: number) => {
    if (!currentUser?.is_admin) return;
    if (window.confirm(`确定要删除 ID: ${targetId} 的用户吗？`)) {
      setAdminUserList(prev => prev.filter(u => u.telegram_id !== targetId));
      if (targetId === currentUser.telegram_id) {
         setCurrentUser(null);
         window.location.reload();
      }
    }
  };

  // --- GAME LOGIC START ---

  const startDealingLogic = (playerNames: string[], isNoShuffle: boolean) => {
    if (!currentUser) return;
    if (currentUser.points < 100) {
      tg.showAlert("积分不足 (需要 100)，请签到或购买！");
      return;
    }

    // Deduct base score (entry fee) immediately
    const baseScore = 100;
    const updatedUser = { ...currentUser, points: currentUser.points - baseScore };
    setCurrentUser(updatedUser);
    setAdminUserList(prev => prev.map(u => u.telegram_id === currentUser.telegram_id ? updatedUser : u));

    const fullDeck = generateDeck();
    const deck = isNoShuffle ? shuffleDeckNoShuffle(fullDeck) : shuffleDeck(fullDeck);
    
    // Store deck for animation
    dealingDeckRef.current = [...deck];
    // Last 3 cards are leftovers
    const leftovers = dealingDeckRef.current.splice(dealingDeckRef.current.length - 3, 3);

    // Initialize players with empty hands
    const newPlayers: Player[] = [
      { ...INITIAL_PLAYER_STATE, id: 0, name: playerNames[0], isHuman: true, hand: [] },
      { ...INITIAL_PLAYER_STATE, id: 1, name: playerNames[1], isHuman: false, hand: [] },
      { ...INITIAL_PLAYER_STATE, id: 2, name: playerNames[2], isHuman: false, hand: [] }
    ];

    setGameState({
      ...INITIAL_GAME_STATE,
      deck: [], // Deck is in ref for animation
      players: newPlayers,
      landlordCards: leftovers,
      phase: GamePhase.Dealing,
      currentTurnIndex: Math.floor(Math.random() * 3), // First bidder
      lastMove: null,
      multiplier: 1,
      baseScore: baseScore,
      bidsCount: 0
    });
    setAiHint("");
    setSelectedCardIds([]);
    setActiveModeSelection(null);
  };

  // Effect: Handle Dealing Animation
  useEffect(() => {
    if (gameState.phase === GamePhase.Dealing) {
        let cardIndex = 0;
        const totalCardsToDeal = 51; // 17 * 3
        
        dealingIntervalRef.current = window.setInterval(() => {
            if (cardIndex >= totalCardsToDeal) {
                if (dealingIntervalRef.current) clearInterval(dealingIntervalRef.current);
                // Dealing finished
                setGameState(prev => ({
                    ...prev,
                    phase: GamePhase.Bidding,
                    // Sort hands after dealing
                    players: prev.players.map(p => ({...p, hand: sortCards(p.hand)}))
                }));
                playTTS("开始抢地主", "Aoede");
                return;
            }

            // Distribute one card
            const cardToDeal = dealingDeckRef.current[cardIndex];
            const playerToReceive = cardIndex % 3; // 0, 1, 2 loop

            setGameState(prev => {
                const updatedPlayers = [...prev.players];
                updatedPlayers[playerToReceive] = {
                    ...updatedPlayers[playerToReceive],
                    hand: [...updatedPlayers[playerToReceive].hand, cardToDeal]
                };
                return { ...prev, players: updatedPlayers };
            });

            cardIndex++;
        }, 50); // Speed of dealing

        return () => {
            if (dealingIntervalRef.current) clearInterval(dealingIntervalRef.current);
        };
    }
  }, [gameState.phase]);

  const openModeSelection = (mode: 'pve' | 'friends' | 'match') => {
    setActiveModeSelection(mode);
  };

  const handleGameStart = (isNoShuffle: boolean) => {
    const mode = activeModeSelection;
    if (!mode) return;
    
    const myName = currentUser?.username || "我";

    if (mode === 'pve') {
      startDealingLogic([myName, "电脑 (左)", "电脑 (右)"], isNoShuffle);
    } else if (mode === 'friends') {
      tg.showAlert("⚠️ 演示模式：多人联机功能开发中。\n\n将为您开启本地模拟对局。");
      startDealingLogic([myName, "牌友 A", "牌友 B"], isNoShuffle);
    } else if (mode === 'match') {
      setIsMatching(true);
      setActiveModeSelection(null);
      setTimeout(() => {
        setIsMatching(false);
        const randomId1 = Math.floor(Math.random() * 900) + 100;
        const randomId2 = Math.floor(Math.random() * 900) + 100;
        startDealingLogic([myName, `玩家 ${randomId1}`, `玩家 ${randomId2}`], isNoShuffle);
      }, 2000); 
    }
  };

  const returnToLobby = () => {
    setGameState(INITIAL_GAME_STATE);
    setAiHint("");
    setSelectedCardIds([]);
  };

  const getVoiceForPlayer = (playerIdx: number) => {
     if (playerIdx === 0) return 'Aoede'; 
     if (playerIdx === 1) return 'Puck'; 
     return 'Kore'; 
  };

  // --- BIDDING LOGIC ---
  const handleBid = (claim: boolean) => {
    const currentPlayerIdx = gameState.currentTurnIndex;
    const voice = getVoiceForPlayer(currentPlayerIdx);
    
    playTTS(claim ? "叫地主!" : "不叫", voice);

    // 1. If someone claims, they become Landlord immediately (Simplified Logic)
    if (claim) {
      const newPlayers = [...gameState.players];
      newPlayers.forEach((p, idx) => {
        p.role = idx === currentPlayerIdx ? PlayerRole.Landlord : PlayerRole.Peasant;
      });

      // Give landlord extra cards
      newPlayers[currentPlayerIdx].hand = sortCards([
        ...newPlayers[currentPlayerIdx].hand, 
        ...gameState.landlordCards
      ]);

      setGameState(prev => ({
        ...prev,
        players: newPlayers,
        phase: GamePhase.Playing,
        currentTurnIndex: currentPlayerIdx,
        lastMove: null
      }));
    } else {
      // 2. If pass, move to next player
      const nextTurn = (gameState.currentTurnIndex + 1) % 3;
      const newBidsCount = gameState.bidsCount + 1;

      // 3. If 3 passes (all passed), Redeal
      if (newBidsCount >= 3) {
        tg.showAlert("所有人都不叫，重新发牌！");
        startDealingLogic(gameState.players.map(p => p.name), false); 
        return;
      }

      setGameState(prev => ({
        ...prev,
        currentTurnIndex: nextTurn,
        bidsCount: newBidsCount
      }));
    }
  };

  // Toggle card selection
  const toggleCardSelection = (cardId: string) => {
    if (gameState.phase !== GamePhase.Playing || gameState.currentTurnIndex !== 0) return;
    
    setSelectedCardIds(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // Play Selected Cards
  const playTurn = useCallback((cardsToPlay: Card[]) => {
    const currentPlayerIdx = gameState.currentTurnIndex;
    const voice = getVoiceForPlayer(currentPlayerIdx);

    const handInfo = determineHandType(cardsToPlay);
    let isValid = false;
    
    if (cardsToPlay.length === 0) {
      // Pass logic
      const isLeader = !gameState.lastMove || gameState.lastMove.playerId === currentPlayerIdx;
      if (!isLeader) {
         isValid = true;
         playTTS("不要", voice);
      }
    } else {
      // Play logic
      if (handInfo.type === HandType.Invalid) {
        console.warn("Invalid hand type");
      } else {
        const isLeader = !gameState.lastMove || gameState.lastMove.playerId === currentPlayerIdx;
        
        if (isLeader) {
          isValid = true;
        } else {
          if (gameState.lastMove) {
            const lastType = gameState.lastMove.type;
            const lastValue = determineHandType(gameState.lastMove.cards).value;
            isValid = canPlayHand(cardsToPlay, gameState.lastMove.cards, lastType, lastValue);
          }
        }
      }
    }

    if (isValid) {
      // Check for Multipliers (Bomb / Rocket)
      let newMultiplier = gameState.multiplier;
      if (handInfo.type === HandType.Bomb) newMultiplier *= 2;
      if (handInfo.type === HandType.Rocket) newMultiplier *= 2;

      // TTS
      if (cardsToPlay.length > 0) {
        if (handInfo.type === HandType.Single) playTTS(cardsToPlay[0].label, voice);
        else if (handInfo.type === HandType.Pair) playTTS(`一对 ${cardsToPlay[0].label}`, voice);
        else if (handInfo.type === HandType.Bomb) playTTS("炸弹!", voice);
        else if (handInfo.type === HandType.Rocket) playTTS("王炸!", voice);
        else playTTS(handInfo.type, voice);
      }

      const newPlayers = [...gameState.players];
      const currentPlayer = newPlayers[currentPlayerIdx];

      if (cardsToPlay.length > 0) {
        const playedIds = new Set(cardsToPlay.map(c => c.id));
        currentPlayer.hand = currentPlayer.hand.filter(c => !playedIds.has(c.id));
        currentPlayer.passes = 0;
      } else {
        currentPlayer.passes += 1;
      }

      // Check Win
      if (currentPlayer.hand.length === 0) {
        playTTS(currentPlayer.id === 0 ? "我赢啦！" : "你输了", "Aoede");
        
        // --- SCORING CALCULATION ---
        const finalScore = gameState.baseScore * newMultiplier;
        const winnerRole = currentPlayer.role;
        
        let scoreChange = 0;
        
        if (currentUser) {
            // Determine if User (ID 0) won or lost
            const myRole = newPlayers[0].role;
            const amIWinner = (myRole === winnerRole); // Same team wins
            
            // If I am Landlord
            if (myRole === PlayerRole.Landlord) {
                scoreChange = amIWinner ? (finalScore * 2) : -(finalScore * 2);
            } else {
                // I am Peasant
                scoreChange = amIWinner ? finalScore : -finalScore;
            }

            const updatedUser = { ...currentUser, points: currentUser.points + scoreChange };
            setCurrentUser(updatedUser);
            setAdminUserList(prev => prev.map(u => u.telegram_id === currentUser.telegram_id ? updatedUser : u));
        }

        setGameState(prev => ({
          ...prev,
          players: newPlayers,
          phase: GamePhase.GameOver,
          winnerId: currentPlayerIdx,
          lastMove: { playerId: currentPlayerIdx, cards: cardsToPlay, type: handInfo.type },
          multiplier: newMultiplier
        }));
        return;
      }

      // Next Turn
      const moveData: Move | null = cardsToPlay.length > 0 
        ? { playerId: currentPlayerIdx, cards: cardsToPlay, type: handInfo.type } 
        : gameState.lastMove; 

      setGameState(prev => ({
        ...prev,
        players: newPlayers,
        lastMove: moveData,
        currentTurnIndex: (prev.currentTurnIndex + 1) % 3,
        multiplier: newMultiplier
      }));
      
      setSelectedCardIds([]);
      setAiHint("");
    } else {
      tg.showAlert("出牌不符合规则！");
    }
  }, [gameState, currentUser]);

  // Bot Logic Effect
  useEffect(() => {
    if (gameState.phase !== GamePhase.Playing) return;
    
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    if (currentPlayer.isHuman) return;

    const timer = setTimeout(() => {
      const isLeader = !gameState.lastMove || gameState.lastMove.playerId === currentPlayer.id;
      const lastCards = isLeader ? null : gameState.lastMove?.cards || null;

      const moveCards = findMove(currentPlayer.hand, lastCards);
      
      if (moveCards) {
        playTurn(moveCards);
      } else {
        playTurn([]); 
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameState, playTurn]);

  // Bot Bidding Effect
  useEffect(() => {
    if (gameState.phase !== GamePhase.Bidding) return;
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    if (currentPlayer.isHuman) return; 

    const timer = setTimeout(() => {
        // Randomly bid. Slightly higher chance to bid if hand has high cards (simplified)
        const highCards = currentPlayer.hand.filter(c => c.value > 13).length; // Ace, 2, Joker
        const bidChance = 0.3 + (highCards * 0.1); 
        const wantsToBid = Math.random() < bidChance;
        handleBid(wantsToBid);
    }, 1000);
    return () => clearTimeout(timer);
  }, [gameState.phase, gameState.currentTurnIndex]);


  const handleHumanPlay = () => {
    const player = gameState.players[0];
    const cards = player.hand.filter(c => selectedCardIds.includes(c.id));
    playTurn(sortCards(cards));
  };

  const handleHumanPass = () => {
     playTurn([]);
  };

  const requestHint = async () => {
    setIsGettingHint(true);
    const me = gameState.players[0];
    const advice = await getSmartHint(
      me.hand, 
      gameState.lastMove, 
      gameState.landlordCards,
      me.role || "农民"
    );
    setAiHint(advice);
    setIsGettingHint(false);
  };


  // Lobby Component
  if (gameState.phase === GamePhase.MainMenu) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-900 to-green-800 text-white overflow-hidden relative">
        
        {/* Lobby Header */}
        <div className="absolute top-0 w-full flex flex-col md:flex-row justify-between items-center p-4 z-40 bg-gradient-to-b from-black/60 to-transparent pb-8 gap-4">
           {/* Left: Points */}
           <div className="flex items-center gap-2">
             <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-2 border border-white/10 shadow-lg">
                <span className="text-xl">💰</span> 
                <span className="font-mono font-bold text-yellow-300">{currentUser?.points.toLocaleString() || 0}</span>
             </div>
             
             <button onClick={handleDailyCheckIn} disabled={hasCheckedInToday} className={`px-3 py-1.5 rounded-full text-sm font-bold shadow-lg transition-all border ${hasCheckedInToday ? 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 border-green-400 text-white animate-pulse'}`}>
                {hasCheckedInToday ? '已签到' : '📅 签到 +1000'}
             </button>

             {/* Sound Toggle */}
             <button onClick={handleToggleSound} className="ml-2 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/20 hover:bg-white/10">
                {isSoundOn ? '🔊' : '🔇'}
             </button>
           </div>

           {/* Center: Buy */}
           <div className="">
             <button onClick={handleBuyStars} disabled={isPaying} className={`bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold px-6 py-2 rounded-full shadow-lg border-2 border-yellow-300 transform transition active:scale-95 flex items-center gap-2 ${isPaying ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span className="text-lg">{isPaying ? '⏳' : '⭐️'}</span> 
                {isPaying ? '处理中...' : '2000积分 / 1星'}
             </button>
           </div>

           {/* Right: Group */}
           <div className="flex gap-2">
             <button onClick={handleOpenGroup} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-4 py-2 rounded-full shadow-lg border-2 border-blue-300 transform transition active:scale-95 flex items-center gap-2 text-sm md:text-base">
                <span>👥</span> 群组
             </button>
             {currentUser?.is_admin && (
               <button onClick={() => setShowAdminPanel(true)} className="bg-red-900/80 hover:bg-red-800 text-white font-bold px-3 py-2 rounded-full border border-red-500 text-sm">
                  ⚙️
               </button>
             )}
           </div>
        </div>

        {/* Background & Overlays (Matchmaking, Admin, Mode Select) */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/poker.png')] opacity-10 pointer-events-none"></div>
        {isMatching && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500 mb-4"></div>
            <div className="text-xl font-bold animate-pulse">正在匹配玩家...</div>
          </div>
        )}
        {showAdminPanel && currentUser?.is_admin && (
           <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in">
              <div className="bg-gray-800 border-2 border-red-500 w-full max-w-2xl rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-red-400">🛡️ 管理员面板</h2>
                    <button onClick={() => setShowAdminPanel(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                 </div>
                 <div className="overflow-y-auto flex-1 pr-2">
                    <table className="w-full text-left border-collapse">
                       <thead><tr className="border-b border-gray-700 text-gray-400"><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Points</th><th className="p-2">Action</th></tr></thead>
                       <tbody>
                          {adminUserList.map(u => (
                             <tr key={u.telegram_id} className="border-b border-gray-700/50 hover:bg-white/5">
                                <td className="p-2 font-mono text-sm">{u.telegram_id}</td>
                                <td className="p-2 text-yellow-200">{u.username}</td>
                                <td className="p-2">{u.points.toLocaleString()}</td>
                                <td className="p-2"><button onClick={() => handleDeleteUser(u.telegram_id)} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded">Del</button></td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}
        {activeModeSelection && (
           <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in p-4">
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 border-2 border-yellow-500/50 p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                 <button onClick={() => setActiveModeSelection(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                 <h2 className="text-2xl font-bold text-center mb-8 text-yellow-400">选择玩法</h2>
                 <div className="flex flex-col gap-4">
                    <button onClick={() => handleGameStart(false)} className="group bg-blue-900/50 hover:bg-blue-800 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between transition-all">
                       <div className="text-left"><div className="font-bold text-lg text-blue-200">经典场</div><div className="text-sm text-blue-400">入场: 100 积分</div></div>
                       <span className="text-2xl group-hover:scale-110 transition-transform">🃏</span>
                    </button>
                    <button onClick={() => handleGameStart(true)} className="group bg-purple-900/50 hover:bg-purple-800 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between transition-all">
                       <div className="text-left"><div className="font-bold text-lg text-purple-200">不洗牌场</div><div className="text-sm text-purple-400">入场: 100 积分</div></div>
                       <span className="text-2xl group-hover:scale-110 transition-transform">💣</span>
                    </button>
                 </div>
              </div>
           </div>
        )}

        {/* Title */}
        <div className="z-10 text-center mb-12 animate-float mt-16">
           <h1 className="text-6xl md:text-7xl font-bold text-yellow-400 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] tracking-widest font-serif">Gemini 斗地主</h1>
           <p className="text-green-200 mt-2 text-lg">AI 驱动的智能棋牌体验</p>
           {currentUser && <div className="mt-2 text-yellow-200 font-mono">欢迎, {currentUser.username}</div>}
        </div>

        {/* Menu Cards */}
        <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-4 md:px-0">
          <button onClick={() => openModeSelection('pve')} className="group relative h-80 bg-gradient-to-b from-blue-600 to-blue-800 rounded-2xl border-4 border-blue-400 shadow-2xl overflow-hidden transform transition-all hover:scale-105 hover:shadow-blue-500/50">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-6xl mb-4 group-hover:animate-bounce">🤖</div>
              <h2 className="text-3xl font-bold mb-2">人机对战</h2>
            </div>
          </button>
          <button onClick={() => openModeSelection('friends')} className="group relative h-80 bg-gradient-to-b from-purple-600 to-purple-800 rounded-2xl border-4 border-purple-400 shadow-2xl overflow-hidden transform transition-all hover:scale-105 hover:shadow-purple-500/50">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-6xl mb-4 group-hover:rotate-12 transition-transform">🤝</div>
              <h2 className="text-3xl font-bold mb-2">牌友约战</h2>
            </div>
          </button>
          <button onClick={() => openModeSelection('match')} className="group relative h-80 bg-gradient-to-b from-orange-600 to-orange-800 rounded-2xl border-4 border-orange-400 shadow-2xl overflow-hidden transform transition-all hover:scale-105 hover:shadow-orange-500/50">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">⚡</div>
              <h2 className="text-3xl font-bold mb-2">自动匹配</h2>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Helper for rendering player
  const renderPlayerArea = (playerIndex: number, position: 'top' | 'left' | 'right' | 'bottom') => {
    const player = gameState.players[playerIndex];
    const isCurrentTurn = gameState.currentTurnIndex === playerIndex;
    const isWinner = gameState.winnerId === playerIndex;
    const overlapClass = position === 'bottom' ? '-ml-8 md:-ml-12' : '-ml-16 md:-ml-20';
    
    return (
      <div className={`flex flex-col items-center ${position === 'left' || position === 'right' ? 'w-32' : 'w-full'} transition-opacity duration-300 ${isCurrentTurn ? 'opacity-100 scale-105' : 'opacity-70'}`}>
        <div className={`relative flex flex-col items-center mb-2 p-2 rounded-lg ${isCurrentTurn ? 'bg-yellow-500/20 border-2 border-yellow-400' : 'bg-black/30'} ${isWinner ? 'bg-yellow-500 animate-bounce text-black' : ''}`}>
          <div className="font-bold text-sm md:text-base whitespace-nowrap">{player.name}</div>
          <div className="text-xs flex items-center gap-1">
            {player.role === PlayerRole.Landlord ? '👑' : player.role === PlayerRole.Peasant ? '👨‍🌾' : '👤'} 
            {player.role}
            <span className="font-mono bg-black/40 px-1 rounded ml-1">{player.hand.length}</span>
          </div>
          {gameState.phase === GamePhase.Playing && isCurrentTurn && !isWinner && (
             <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">思考中...</div>
          )}
        </div>

        <div className="flex justify-center items-center h-24 md:h-32 perspective-1000">
          {player.isHuman ? (
             <div className="flex pl-12">
               {player.hand.map((card, idx) => (
                 <div key={card.id} className={`${idx > 0 ? overlapClass : ''} transition-all duration-200 hover:z-10`} style={{ zIndex: idx }}>
                   <CardComponent card={card} selected={selectedCardIds.includes(card.id)} onClick={() => toggleCardSelection(card.id)} />
                 </div>
               ))}
             </div>
          ) : (
            <div className="flex pl-8">
               {player.hand.map((card, idx) => (
                 <div key={card.id} className={`${idx > 0 ? '-ml-8' : ''}`} style={{ zIndex: idx }}>
                    <CardComponent card={card} hidden small />
                 </div>
               ))}
            </div>
          )}
        </div>
        
        {gameState.lastMove && gameState.lastMove.playerId === playerIndex && gameState.phase !== GamePhase.GameOver && (
          <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
             <div className="bg-black/60 p-2 rounded-xl flex gap-1 animate-fade-in-up">
                {gameState.lastMove.cards.length > 0 ? (
                  gameState.lastMove.cards.map((c) => <CardComponent key={c.id} card={c} small />)
                ) : (
                  <span className="text-white font-bold px-4 py-2">不出</span>
                )}
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 overflow-hidden bg-gradient-to-br from-green-900 to-green-800 font-sans">
      
      {/* Top Bar */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 bg-black/20 p-2 rounded-lg backdrop-blur-sm">
             <div className="text-xs text-gray-300 mb-1 w-full text-center uppercase tracking-wider hidden md:block">底牌</div>
             <div className="flex gap-2">
               {gameState.landlordCards.length > 0 ? (
                 gameState.landlordCards.map(c => (
                   <CardComponent key={c.id} card={c} small hidden={gameState.phase === GamePhase.Dealing || gameState.phase === GamePhase.Bidding} />
                 ))
               ) : (
                 [1,2,3].map(i => <div key={i} className="w-10 h-14 bg-white/10 rounded border border-white/20"></div>)
               )}
             </div>
          </div>
          <div className="bg-black/30 text-white text-xs px-2 py-1 rounded-full text-center font-mono">
            底分: {gameState.baseScore} | 倍数: x{gameState.multiplier}
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
           <h1 className="text-xl md:text-2xl font-bold text-yellow-400 drop-shadow-md">Gemini 斗地主</h1>
           <div className="text-xs text-gray-300">阶段: {gameState.phase}</div>
           <button onClick={handleToggleSound} className="mt-2 text-xl bg-black/20 rounded-full w-8 h-8 flex items-center justify-center">
             {isSoundOn ? '🔊' : '🔇'}
           </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 w-full max-w-6xl grid grid-cols-3 grid-rows-[1fr_auto] gap-4 mt-4">
        
        <div className="col-span-1 row-span-1 flex items-center justify-start">{renderPlayerArea(1, 'left')}</div>

        <div className="col-span-1 row-span-1 flex flex-col items-center justify-center relative">
           
           {gameState.phase === GamePhase.GameOver && (
             <div className="bg-black/80 p-8 rounded-xl text-center backdrop-blur-md animate-bounce-in z-50 border-2 border-yellow-500 shadow-2xl">
               <h2 className="text-5xl font-bold mb-4 text-white drop-shadow-lg">
                 {gameState.winnerId === 0 ? "🎉 胜利! 🎉" : "😢 失败..."}
               </h2>
               <p className="mb-2 text-gray-300 text-xl">
                 赢家: {gameState.players[gameState.winnerId!].name}
               </p>
               <div className="mb-6 text-yellow-300 font-mono text-lg">
                 总分结算: {gameState.baseScore * gameState.multiplier * (gameState.players[0].role === PlayerRole.Landlord ? 2 : 1)} 分
               </div>
               <div className="flex gap-4 justify-center">
                  <button onClick={() => startDealingLogic(gameState.players.map(p => p.name), false)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-full transform transition hover:scale-105">再来一局</button>
                  <button onClick={returnToLobby} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-full transform transition hover:scale-105">返回大厅</button>
               </div>
             </div>
           )}

           {gameState.phase === GamePhase.Bidding && gameState.currentTurnIndex === 0 && (
             <div className="flex gap-4 z-50 animate-bounce-in">
               <button onClick={() => handleBid(true)} className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 px-8 rounded-full shadow-lg border-2 border-orange-300 transform transition active:scale-95">叫地主</button>
               <button onClick={() => handleBid(false)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-full shadow-lg border-2 border-gray-400 transform transition active:scale-95">不叫</button>
             </div>
           )}
        </div>

        <div className="col-span-1 row-span-1 flex items-center justify-end">{renderPlayerArea(2, 'right')}</div>

        <div className="col-span-3 row-start-2 flex flex-col items-center justify-end pb-4">
          
          <div className="w-full max-w-2xl flex items-center justify-center gap-4 mb-6 min-h-[48px]">
             {gameState.phase === GamePhase.Playing && gameState.currentTurnIndex === 0 && (
               <>
                 <button 
                   onClick={handleHumanPass} 
                   className={`px-6 py-2 rounded-full font-bold shadow-lg transition-colors ${(!gameState.lastMove || gameState.lastMove.playerId === 0) ? 'bg-gray-500 cursor-not-allowed opacity-50' : 'bg-red-600 hover:bg-red-500 text-white border border-red-400'}`}
                   disabled={!gameState.lastMove || gameState.lastMove.playerId === 0}
                 >不出</button>
                 
                 <button 
                   onClick={handleHumanPlay}
                   disabled={selectedCardIds.length === 0}
                   className={`px-8 py-2 rounded-full font-bold shadow-lg transition-transform active:scale-95 border ${selectedCardIds.length > 0 ? 'bg-green-600 hover:bg-green-500 text-white border-green-400' : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'}`}
                 >出牌</button>

                 <button onClick={requestHint} disabled={isGettingHint} className="ml-8 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-full shadow-lg border border-purple-400/30 transition-all hover:shadow-purple-500/30">
                    {isGettingHint ? <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <span>✨ AI 提示</span>}
                 </button>
               </>
             )}
          </div>

          {aiHint && (
             <div className="mb-4 bg-purple-900/90 border border-purple-500/50 text-purple-100 p-3 rounded-lg text-sm max-w-lg text-center backdrop-blur shadow-xl animate-fade-in z-50">
                <span className="font-bold text-purple-300">Gemini 军师:</span> {aiHint}
             </div>
          )}

          {renderPlayerArea(0, 'bottom')}
        </div>
      </div>
    </div>
  );
};

export default App;