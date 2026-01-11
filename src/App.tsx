
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, GamePhase, GameState, PlayerHand, Seat, TableResult, User } from './types';
import { getLocalSuggestions, isValidArrangement } from './services/suggestions';
import { HandRow } from './components/HandRow';
import { CardComponent } from './components/CardComponent';
import { getCarriage, getPlayerSubmissions, submitPlayerHand, settleGame, getCarriagePlayerCount } from './services/mockBackend';

const TEMP_GUEST_ID = 'guest_' + Math.floor(Math.random() * 10000);

const LOBBY_TABLES = [
  { id: 1, name: "今晚 20:00 结算场", carriageId: 1, minScore: 100 },
  { id: 2, name: "明日 12:00 结算场", carriageId: 2, minScore: 100 },
];

const INITIAL_STATE: GameState = {
  phase: GamePhase.LOBBY,
  user: null,
  currentCarriageId: 1,
  currentRound: 1, // Start at Carriage/Round 1
  currentTableIndex: 0,
  tableQueue: [],
  mySeat: 'East',
  currentCards: [],
  currentArrangement: { top: [], middle: [], bottom: [] },
  submissions: [],
  settlementReport: null,
  aiSuggestions: [],
  currentSuggestionIndex: -1,
};

// Server Seat Interface
interface ServerSeat {
    carriage_id: number;
    seat: Seat;
    user_id: number;
    nickname: string;
    game_round?: number; 
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  
  const [lobbySelection, setLobbySelection] = useState<{carriageId: number, seat: Seat} | null>(null);
  
  const [occupiedSeats, setOccupiedSeats] = useState<ServerSeat[]>([]);
  const pollingRef = useRef<number | null>(null);

  const [showAuthModal, setShowAuthModal] = useState<'login' | 'register' | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [authForm, setAuthForm] = useState({ phone: '', nickname: '', password: '' });
  const [walletForm, setWalletForm] = useState({ 
      searchPhone: '', 
      targetUser: null as { id: number, nickname: string } | null, 
      amount: '' 
  });
  const [walletMsg, setWalletMsg] = useState('');

  // --- PWA Install State ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // --- Initialization ---

  useEffect(() => {
      fetch('/api/setup').catch(() => {});

      const cachedUser = localStorage.getItem('shisanshui_user');
      if (cachedUser) {
          try {
              const u = JSON.parse(cachedUser);
              setGameState(prev => ({ ...prev, user: u }));
          } catch(e) {}
      }
      
      const pid = gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID;
      const subs = getPlayerSubmissions(pid);
      setGameState(prev => ({ ...prev, submissions: subs }));

      // PWA Install Detection
      const handler = (e: any) => {
        e.preventDefault(); // Prevent mini-infobar
        setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);

      // Detect iOS
      const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      // Check if not already in standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (isIosDevice && !isStandalone) {
          setIsIOS(true);
      }

      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
     if (gameState.user) {
         const subs = getPlayerSubmissions(`u_${gameState.user.id}`);
         setGameState(prev => ({ ...prev, submissions: subs }));
     }
  }, [gameState.user]);

  // 2. Polling Logic (Get Seats)
  const fetchSeats = useCallback(async () => {
      try {
          const res = await fetch('/api/game/seat');
          if (res.ok) {
            const data = await res.json() as any;
            if (data.seats) setOccupiedSeats(data.seats);
          }
      } catch (e) {
          console.error("Polling error", e);
      }
  }, []);

  // Combined Polling Effect
  useEffect(() => {
      if (gameState.phase === GamePhase.LOBBY || gameState.phase === GamePhase.GAME_OVER || gameState.phase === GamePhase.PLAYING) {
          fetchSeats(); 
          pollingRef.current = window.setInterval(fetchSeats, 2000); 
      } else {
          if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
          }
      }
      return () => { 
          if (pollingRef.current) clearInterval(pollingRef.current); 
      };
  }, [gameState.phase, fetchSeats]);


  // --- Auth Handlers ---
  const handleRegister = async () => {
      if(authForm.password.length < 6) return alert("密码需至少6位");
      try {
          const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(authForm)
          });
          const data = await res.json() as any;
          if (data.error) throw new Error(data.error);
          alert("注册成功，请登录");
          setShowAuthModal('login');
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleLogin = async () => {
      try {
          const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ phone: authForm.phone, password: authForm.password })
          });
          const data = await res.json() as any;
          if (data.error) throw new Error(data.error);
          
          setGameState(prev => ({ ...prev, user: data.user }));
          localStorage.setItem('shisanshui_user', JSON.stringify(data.user));
          setShowAuthModal(null);
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleLogout = async () => {
      await handleLeaveSeat(); 
      setGameState(prev => ({ ...prev, user: null }));
      localStorage.removeItem('shisanshui_user');
      setLobbySelection(null);
  };

  // --- Wallet Handlers ---
  const handleSearchUser = async () => {
      if (!walletForm.searchPhone) return;
      setWalletMsg('Searching...');
      try {
          const res = await fetch('/api/user/search', {
              method: 'POST',
              body: JSON.stringify({ query: walletForm.searchPhone })
          });
          const data = await res.json() as any;
          if (data.found) {
              setWalletForm(prev => ({ ...prev, targetUser: data.user }));
              setWalletMsg('');
          } else {
              setWalletForm(prev => ({ ...prev, targetUser: null }));
              setWalletMsg('未找到该用户');
          }
      } catch (e) {
          setWalletMsg('搜索出错');
      }
  };

  const handleTransfer = async () => {
      if (!gameState.user || !walletForm.targetUser || !walletForm.amount) return;
      try {
          const res = await fetch('/api/user/transfer', {
              method: 'POST',
              body: JSON.stringify({ 
                  fromId: gameState.user.id, 
                  toId: walletForm.targetUser.id, 
                  amount: walletForm.amount 
              })
          });
          const data = await res.json() as any;
          if (data.error) throw new Error(data.error);
          
          const newUser = { ...gameState.user, points: data.newPoints };
          setGameState(prev => ({ ...prev, user: newUser }));
          localStorage.setItem('shisanshui_user', JSON.stringify(newUser));
          
          alert("转账成功！");
          setWalletForm({ searchPhone: '', targetUser: null, amount: '' });
          setShowWalletModal(false);
      } catch (e: any) {
          alert(e.message);
      }
  };

  // --- PWA Installation Logic ---
  const handleInstallClick = async () => {
      if (isIOS) {
          setShowIOSPrompt(true);
      } else if (installPrompt) {
          installPrompt.prompt();
          const { outcome } = await installPrompt.userChoice;
          if (outcome === 'accepted') {
              setInstallPrompt(null);
          }
      }
  };

  // --- Seating Logic ---

  const handleSeatSelect = async (carriageId: number, seat: Seat) => {
      if (!gameState.user) {
          setShowAuthModal('login');
          return;
      }
      if (lobbySelection?.carriageId === carriageId && lobbySelection?.seat === seat) {
          await handleLeaveSeat();
          return;
      }
      setLobbySelection({ carriageId, seat });
      try {
          const res = await fetch('/api/game/seat', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  carriageId,
                  seat,
                  userId: gameState.user.id,
                  nickname: gameState.user.nickname,
                  action: 'join'
              })
          });
          
          if (!res.ok) {
              const data = await res.json() as any;
              alert(data.error || "抢座失败");
              setLobbySelection(null); 
          }
          fetchSeats();
      } catch (e) {
          console.error(e);
          setLobbySelection(null);
      }
  };

  const handleLeaveSeat = async () => {
      if (!gameState.user) return;
      setLobbySelection(null);
      try {
          await fetch('/api/game/seat', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  action: 'leave',
                  userId: gameState.user.id
              })
          });
          fetchSeats();
      } catch(e) { console.error(e); }
  };

  const handleEnterGame = async () => {
      if (!lobbySelection) return;
      if (!gameState.user) {
          setShowAuthModal('login');
          return;
      }

      let latestSeats: ServerSeat[] = occupiedSeats;
      try {
        const res = await fetch('/api/game/seat');
        if (res.ok) {
            const data = await res.json() as any;
            if (data.seats) {
                latestSeats = data.seats;
                setOccupiedSeats(data.seats);
            }
        }
      } catch(e) { console.error("Sync failed", e); }

      const { carriageId, seat } = lobbySelection;
      const playersInCarriage = latestSeats.filter(s => Number(s.carriage_id) === Number(carriageId));
      const mySeatEntry = playersInCarriage.find(s => Number(s.user_id) === Number(gameState.user!.id));

      if (!mySeatEntry || mySeatEntry.seat !== seat) {
          alert("无法进入：服务器尚未确认您的座位。请尝试重新选座。");
          fetchSeats(); 
          return;
      }

      // Check number of players
      if (playersInCarriage.length < 2) { 
          alert(`当前只有 ${playersInCarriage.length} 位玩家，需要至少 2 人。`);
          return;
      }

      // Determine Starting Round
      const startRound = mySeatEntry.game_round || 1;

      // Start Game
      const carriageMockData = getCarriage(carriageId); 
      if (!carriageMockData) return alert("System Error: Local Carriage Data not found");

      const queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      
      const firstTableId = queue[0];
      const cards = carriageMockData.tables[firstTableId].hands[seat];
      const suggestions = getLocalSuggestions(cards);

      setGameState(prev => ({
        ...prev,
        phase: GamePhase.PLAYING,
        currentCarriageId: carriageId,
        currentRound: startRound, 
        currentTableIndex: 0,
        tableQueue: queue,
        mySeat: seat, 
        currentCards: cards,
        currentArrangement: suggestions[0],
        aiSuggestions: suggestions,
        currentSuggestionIndex: 0
      }));
      setSelectedCardIds([]);
  };

  const handleQuitGame = async () => {
      await handleLeaveSeat();
      setGameState(prev => ({ ...prev, phase: GamePhase.LOBBY }));
  };

  const handleNextCarriage = async () => {
      if (!gameState.user) return;
      const nextRound = gameState.currentRound + 1;
      const { currentCarriageId, mySeat } = gameState;

      try {
          await fetch('/api/game/seat', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  action: 'next_round',
                  userId: gameState.user.id,
                  carriageId: currentCarriageId,
                  seat: mySeat,
                  nextRound: nextRound
              })
          });
      } catch(e) { console.error("Failed to update round", e); }

      const carriageMockData = getCarriage(currentCarriageId)!;
      const queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      const firstTableId = queue[0];
      const cards = carriageMockData.tables[firstTableId].hands[mySeat]; 
      const suggestions = getLocalSuggestions(cards);

      setGameState(prev => ({
          ...prev,
          phase: GamePhase.PLAYING,
          currentRound: nextRound,
          currentTableIndex: 0,
          tableQueue: queue,
          currentCards: cards,
          currentArrangement: suggestions[0],
          aiSuggestions: suggestions,
          currentSuggestionIndex: 0
      }));
      setSelectedCardIds([]);
  };

  // --- Gameplay Logic ---

  const handleCardClick = (card: Card) => {
    if (gameState.phase !== GamePhase.PLAYING) return;
    setSelectedCardIds(prev => prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]);
  };

  const handleRowClick = (targetSegment: 'top' | 'middle' | 'bottom') => {
      if (gameState.phase !== GamePhase.PLAYING || selectedCardIds.length === 0) return;

      setGameState(prev => {
          const currentArrangement = prev.currentArrangement;
          const newArrangement = { top: [...currentArrangement.top], middle: [...currentArrangement.middle], bottom: [...currentArrangement.bottom] };
          const cardsToMove: Card[] = [];

          (['top', 'middle', 'bottom'] as const).forEach(key => {
              const staying = [];
              for (const card of newArrangement[key]) {
                  if (selectedCardIds.includes(card.id)) cardsToMove.push(card);
                  else staying.push(card);
              }
              newArrangement[key] = staying;
          });

          newArrangement[targetSegment] = [...newArrangement[targetSegment], ...cardsToMove];
          return { ...prev, currentArrangement: newArrangement };
      });
      setSelectedCardIds([]);
  };

  const handleSmartArrange = () => {
      if (gameState.aiSuggestions.length === 0) return;
      const nextIndex = (gameState.currentSuggestionIndex + 1) % gameState.aiSuggestions.length;
      setGameState(prev => ({
          ...prev,
          currentSuggestionIndex: nextIndex,
          currentArrangement: prev.aiSuggestions[nextIndex]
      }));
      setSelectedCardIds([]);
  };

  const submitHand = () => {
      const { top, middle, bottom } = gameState.currentArrangement;
      if (top.length !== 3 || middle.length !== 5 || bottom.length !== 5) {
          alert("请确保头墩3张、中墩5张、尾墩5张！");
          return;
      }

      // Validate Logic Check
      const validation = isValidArrangement(gameState.currentArrangement);
      if (!validation.valid) {
          alert(`牌型违规: ${validation.error}`);
          return;
      }

      const pid = gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID;
      const currentTableId = gameState.tableQueue[gameState.currentTableIndex];
      
      submitPlayerHand(pid, {
          carriageId: gameState.currentCarriageId,
          roundId: gameState.currentRound, 
          tableId: currentTableId,
          seat: gameState.mySeat,
          hand: gameState.currentArrangement,
          timestamp: Date.now()
      });

      const nextIndex = gameState.currentTableIndex + 1;
      
      if (nextIndex >= 10) {
          setGameState(prev => ({ ...prev, phase: GamePhase.GAME_OVER }));
      } else {
          const carriage = getCarriage(gameState.currentCarriageId)!;
          const nextTableId = gameState.tableQueue[nextIndex];
          const nextCards = carriage.tables[nextTableId].hands[gameState.mySeat];
          const suggestions = getLocalSuggestions(nextCards);

          setGameState(prev => ({
              ...prev,
              currentTableIndex: nextIndex,
              currentCards: nextCards,
              currentArrangement: suggestions[0],
              aiSuggestions: suggestions,
              currentSuggestionIndex: 0
          }));
          setSelectedCardIds([]);
      }
  };

  const handleShowSettlement = () => {
      const pid = gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID;
      const report = settleGame(pid);
      setGameState(prev => ({ ...prev, phase: GamePhase.SETTLEMENT_VIEW, settlementReport: report }));
  };

  // --- Views ---

  // Compact Hand Row for Table View (Overlapping)
  const ShowdownHand = ({ cards }: { cards: Card[] }) => (
      <div className="flex -space-x-2.5 sm:-space-x-3 items-center justify-center">
          {cards.map((c, i) => (
              <CardComponent 
                key={i} 
                card={c} 
                small 
                className="w-6 h-9 sm:w-8 sm:h-12 text-[8px] sm:text-[10px] shadow-sm ring-1 ring-black/20" 
              />
          ))}
      </div>
  );

  const ReportView = () => {
      if (!gameState.settlementReport) return <div>Calculating...</div>;
      const { groupedResults, totalScore } = gameState.settlementReport;
      
      // State for Navigation
      const [selectedRound, setSelectedRound] = useState<number | null>(null);
      const [tableIndex, setTableIndex] = useState(0);

      // LIST MODE: If no round selected, show session list
      if (!selectedRound) {
          // Get available round IDs (e.g. 1, 2, 3)
          const rounds = groupedResults ? Object.keys(groupedResults).map(Number).sort((a,b) => b - a) : []; // Newest first

          return (
              <div className="h-full w-full bg-green-950 flex flex-col overflow-hidden">
                  <div className="shrink-0 p-4 bg-black/20 backdrop-blur-md border-b border-white/5 flex justify-between items-center z-10">
                       <h2 className="text-xl font-black text-yellow-400">战绩列表</h2>
                       <div className="text-xs text-white/50">总盈亏: <span className={totalScore >=0 ? 'text-red-400':'text-green-400'}>{totalScore}</span></div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {rounds.length === 0 && <div className="text-white/30 text-center mt-10">暂无战绩</div>}
                      
                      {rounds.map(rId => {
                          const tables = groupedResults![rId];
                          // Calculate round total score for current player
                          const pid = gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID;
                          let rScore = 0;
                          tables.forEach(t => {
                              if(!t.voided) rScore += (t.scores[pid] || 0);
                          });

                          return (
                              <button 
                                  key={rId} 
                                  onClick={() => setSelectedRound(rId)}
                                  className="w-full bg-black/30 border border-white/10 p-4 rounded-xl flex justify-between items-center hover:bg-black/50 active:scale-95 transition-all"
                              >
                                  <div className="text-left">
                                      <div className="text-yellow-400 font-bold text-lg">第 {rId} 场次</div>
                                      <div className="text-white/40 text-xs">共 {tables.length} 局对战</div>
                                  </div>
                                  <div className={`text-xl font-mono font-bold ${rScore >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                      {rScore > 0 ? '+' : ''}{rScore}
                                  </div>
                              </button>
                          );
                      })}
                  </div>

                  <div className="p-4 bg-gradient-to-t from-black to-transparent">
                      <button onClick={() => setGameState(prev => ({...prev, phase: GamePhase.LOBBY}))} className="w-full py-4 bg-yellow-600 rounded-xl font-bold text-white shadow-lg">返回大厅</button>
                  </div>
              </div>
          );
      }

      // DETAIL MODE: Show specific round
      const roundData = groupedResults && groupedResults[selectedRound] ? groupedResults[selectedRound] : [];
      const currentTable = roundData[tableIndex] || roundData[0];
      const { details, voided } = currentTable || { details: [], voided: true };

      // Helper to place players in N/S/E/W grid
      const positions: Record<Seat, React.CSSProperties> = {
          'North': { top: '5%', left: '50%', transform: 'translateX(-50%)' },
          'South': { bottom: '20%', left: '50%', transform: 'translateX(-50%)' },
          'West':  { top: '50%', left: '2%', transform: 'translateY(-50%)' },
          'East':  { top: '50%', right: '2%', transform: 'translateY(-50%)' }
      };

      const renderPlayer = (seat: Seat) => {
          const p = details.find(d => d.seat === seat);
          if (!p) {
              return (
                  <div style={positions[seat]} className="absolute flex flex-col items-center opacity-30">
                      <div className="w-12 h-12 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white/50 text-xs">空</div>
                  </div>
              );
          }

          const isMe = p.playerId === (gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID);
          return (
              <div style={positions[seat]} className="absolute flex flex-col items-center z-10 w-[40%] sm:w-[30%] max-w-[180px]">
                  <div className={`flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full ${isMe ? 'bg-yellow-600/90 text-white' : 'bg-black/60 text-white/80'}`}>
                      <span className="text-[10px] font-bold truncate max-w-[60px]">{p.name}</span>
                      <span className={`text-[10px] font-mono font-bold ${p.score >= 0 ? 'text-red-300' : 'text-green-300'}`}>
                          {p.score > 0 ? '+' : ''}{p.score}
                      </span>
                  </div>
                  <div className="flex flex-col gap-1 p-1.5 bg-black/40 rounded-lg border border-white/10 shadow-xl backdrop-blur-sm transition-all hover:scale-105">
                      {p.specialType ? (
                          <div className="h-24 w-full flex items-center justify-center bg-yellow-500/20 rounded border border-yellow-500/30">
                              <span className="text-yellow-400 font-bold text-xs text-center px-1">{p.specialType}</span>
                          </div>
                      ) : (
                          <>
                              <ShowdownHand cards={p.hand.top} />
                              <ShowdownHand cards={p.hand.middle} />
                              <ShowdownHand cards={p.hand.bottom} />
                          </>
                      )}
                  </div>
              </div>
          );
      };

      return (
          <div className="h-full w-full bg-green-950 flex flex-col overflow-hidden relative">
              {/* Header with Back Button */}
              <div className="shrink-0 h-14 bg-black/30 backdrop-blur flex justify-between items-center px-4 border-b border-white/5 z-20">
                   <button onClick={() => setSelectedRound(null)} className="flex items-center text-white/70 hover:text-white">
                       <span className="text-lg mr-1">‹</span> 返回列表
                   </button>
                   <div className="text-yellow-400 font-bold">第 {selectedRound} 场</div>
                   <div className="w-16"></div> {/* Spacer */}
              </div>

              {/* Table Surface */}
              <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#1e6f3e,_#0f3922)] overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <div className="w-[60%] h-[40%] border-4 border-yellow-600/50 rounded-[4rem]"></div>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <div className="text-yellow-500/20 font-black text-6xl">VS</div>
                      <div className="text-white/40 text-xs mt-2 font-mono">Round {selectedRound} - Table {tableIndex + 1}</div>
                      {voided && <div className="text-red-500 font-bold border border-red-500 px-2 py-1 rounded mt-2">流局 (人不满)</div>}
                  </div>
                  {renderPlayer('North')}
                  {renderPlayer('West')}
                  {renderPlayer('East')}
                  {renderPlayer('South')}
              </div>

              {/* Pagination Footer */}
              <div className="h-20 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 pb-4 border-t border-white/10 z-20">
                  <button 
                      onClick={() => setTableIndex(Math.max(0, tableIndex - 1))}
                      disabled={tableIndex === 0}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all"
                  >
                      &lt; 上一局
                  </button>
                  <div className="flex flex-col items-center">
                      <span className="text-yellow-400 font-black text-xl font-mono">{tableIndex + 1} <span className="text-white/40 text-sm">/ 10</span></span>
                  </div>
                  <button 
                      onClick={() => setTableIndex(Math.min(9, tableIndex + 1))}
                      disabled={tableIndex >= 9}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all"
                  >
                      下一局 &gt;
                  </button>
              </div>
          </div>
      );
  };

  const renderSeatButton = (carriageId: number, seat: Seat, label: string, className: string) => {
      const occupant = occupiedSeats.find(s => Number(s.carriage_id) === Number(carriageId) && s.seat === seat);
      const isMe = occupant && gameState.user && Number(occupant.user_id) === Number(gameState.user.id);
      const isSelected = lobbySelection?.carriageId === carriageId && lobbySelection?.seat === seat;
      
      const roundNum = occupant?.game_round || 1;

      return (
          <button 
              onClick={(e) => { 
                  e.stopPropagation(); 
                  if (occupant && !isMe) return; 
                  handleSeatSelect(carriageId, seat); 
              }}
              className={`
                absolute w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all shadow-lg backdrop-blur-sm group
                ${className}
                ${occupant
                    ? (isMe 
                        ? 'bg-yellow-600 border-yellow-400 scale-110 shadow-yellow-500/50 z-20' 
                        : 'bg-red-900/80 border-red-500/50 scale-100 cursor-not-allowed')
                    : (isSelected 
                        ? 'bg-yellow-500/50 border-yellow-200 animate-pulse'
                        : 'bg-black/40 border-white/10 hover:bg-yellow-600/80 hover:border-yellow-400 hover:scale-110')
                }
              `}
          >
              {occupant ? (
                  <>
                    <div className="relative w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden uppercase">
                        {occupant.nickname.slice(0, 2)}
                    </div>
                    {/* Round Indicator Badge */}
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[8px] px-1 rounded-full border border-white/20 shadow-sm scale-90">
                        R{roundNum}
                    </div>
                    <span className="text-[8px] text-white/80 max-w-full truncate px-1 scale-75 origin-center">{isMe ? '我' : occupant.nickname}</span>
                  </>
              ) : (
                  <>
                    <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>{label}</span>
                    <span className={`text-[9px] uppercase ${isSelected ? 'text-white/80' : 'text-white/40 group-hover:text-white/80'}`}>{seat[0]}</span>
                  </>
              )}
          </button>
      );
  };

  return (
    <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 font-sans flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 opacity-5 pointer-events-none z-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>

      {/* iOS Install Prompt Modal */}
      {showIOSPrompt && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
            <div className="bg-green-900 border border-white/20 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-pop-in mb-8">
                 <div className="text-center">
                     <h3 className="text-xl font-bold text-yellow-400 mb-2">安装到手机</h3>
                     <p className="text-white/70 text-sm mb-4">
                         在 iOS Safari 上，请点击底部的 <strong className="text-white">分享图标</strong>
                         <br/>然后选择 <strong className="text-white">添加到主屏幕</strong>。
                     </p>
                     <div className="w-12 h-12 bg-white/10 rounded-xl mx-auto flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                     </div>
                     <button onClick={() => setShowIOSPrompt(false)} className="text-yellow-400 font-bold text-sm">我知道了</button>
                 </div>
                 {/* Arrow pointer roughly where Safari share button is */}
                 <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-900 border-b border-r border-white/20 transform rotate-45"></div>
            </div>
        </div>
      )}

      {/* ... Auth & Wallet Modals (Same as before) ... */}
      {showAuthModal && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-green-900 border border-yellow-500/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
                  <button onClick={() => setShowAuthModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
                  <h2 className="text-xl font-bold text-yellow-400 mb-6 text-center">{showAuthModal === 'login' ? '账号登录' : '新用户注册'}</h2>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-white/50 mb-1 block">手机号</label>
                          <input type="tel" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
                      </div>
                      {showAuthModal === 'register' && (
                          <div>
                              <label className="text-xs text-white/50 mb-1 block">昵称</label>
                              <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" value={authForm.nickname} onChange={e => setAuthForm({...authForm, nickname: e.target.value})} />
                          </div>
                      )}
                      <div>
                          <label className="text-xs text-white/50 mb-1 block">密码</label>
                          <input type="password" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                      </div>
                      <button onClick={showAuthModal === 'login' ? handleLogin : handleRegister} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl mt-4 active:scale-95 transition-all">{showAuthModal === 'login' ? '立即登录' : '提交注册'}</button>
                  </div>
              </div>
          </div>
      )}

      {showWalletModal && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-green-900 border border-yellow-500/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
                   <button onClick={() => setShowWalletModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
                   <h2 className="text-xl font-bold text-yellow-400 mb-2 text-center">积分管理</h2>
                   <p className="text-center text-white/50 text-sm mb-6">当前积分: <span className="text-white font-mono">{gameState.user?.points || 0}</span></p>

                   <div className="space-y-4">
                       <div className="flex gap-2">
                           <input 
                               type="tel" 
                               className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-yellow-500" 
                               placeholder="输入对方手机号"
                               value={walletForm.searchPhone}
                               onChange={e => setWalletForm({...walletForm, searchPhone: e.target.value})}
                           />
                           <button onClick={handleSearchUser} className="bg-white/10 px-4 rounded-lg hover:bg-white/20">搜索</button>
                       </div>
                       
                       {walletMsg && <div className="text-xs text-center text-red-400">{walletMsg}</div>}

                       {walletForm.targetUser && (
                           <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                               <div className="text-sm text-white/70">接收人: <span className="text-yellow-400 font-bold">{walletForm.targetUser.nickname}</span></div>
                               <input 
                                   type="number" 
                                   className="w-full mt-2 bg-black/40 border border-white/10 rounded px-2 py-1 text-white outline-none"
                                   placeholder="转账金额"
                                   value={walletForm.amount}
                                   onChange={e => setWalletForm({...walletForm, amount: e.target.value})}
                               />
                               <button onClick={handleTransfer} className="w-full mt-3 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-sm">
                                   确认转账
                               </button>
                           </div>
                       )}
                   </div>
              </div>
          </div>
      )}

      {gameState.phase === GamePhase.SETTLEMENT_VIEW ? (
          <ReportView />
      ) : gameState.phase === GamePhase.GAME_OVER ? (
          /* --- GAME OVER / INTERMISSION VIEW --- */
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-md relative z-10">
              <div className="w-full max-w-md bg-green-900/90 border border-yellow-500/50 rounded-3xl p-8 shadow-2xl text-center">
                  <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/20">
                      <span className="text-4xl">🏁</span>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-2">本场次完成</h2>
                  <p className="text-white/60 mb-8">
                      您已完成第 <span className="text-yellow-400 font-bold text-xl">{gameState.currentRound}</span> 车厢的对局。
                  </p>
                  
                  <div className="space-y-4">
                      <button 
                          onClick={handleNextCarriage}
                          className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-green-950 font-black text-xl rounded-xl shadow-xl active:scale-95 transition-all"
                      >
                          继续下一场 (Round {gameState.currentRound + 1})
                      </button>
                      <div className="text-xs text-white/40">点击继续将自动进入下一车厢，所有同伴也会同步进入。</div>
                      
                      <div className="h-px bg-white/10 my-4"></div>
                      
                      <button 
                          onClick={handleQuitGame}
                          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/10 active:scale-95 transition-all"
                      >
                          退出游戏 (返回大厅)
                      </button>
                  </div>
              </div>
          </div>
      ) : gameState.phase === GamePhase.LOBBY ? (
        <div className="flex-1 flex flex-col h-full w-full relative">
            <div className="w-full h-16 bg-black/20 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-10 shrink-0 relative">
                {/* Left Side: User/Login */}
                {gameState.user ? (
                    <button onClick={handleLogout} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors z-20">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center border border-white/10 font-bold text-xs">
                            {gameState.user.nickname[0]}
                        </div>
                        <div className="flex flex-col items-start">
                             <span className="text-sm font-bold leading-none">{gameState.user.nickname}</span>
                             <span className="text-[10px] text-white/40">退出</span>
                        </div>
                    </button>
                ) : (
                    <button onClick={() => setShowAuthModal('login')} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors z-20">
                        <span className="text-sm font-bold">登录/注册</span>
                    </button>
                )}
                
                {/* Center: Battle Record (Absolute Centered) */}
                <button onClick={handleShowSettlement} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-10">
                    <span className="text-yellow-400 font-black text-lg leading-none tracking-wider group-hover:scale-110 transition-transform drop-shadow-md">我的战绩</span>
                    <span className="text-[9px] text-white/40 group-hover:text-white/60">点击查看</span>
                </button>

                {/* Right Side: Install + Points */}
                <div className="flex items-center gap-2 z-20">
                    {(installPrompt || isIOS) && (
                        <button 
                            onClick={handleInstallClick} 
                            className="flex items-center gap-1.5 bg-yellow-600/20 border border-yellow-500/50 rounded-full px-3 py-1 animate-pulse"
                        >
                            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span className="text-[10px] text-yellow-400 font-bold hidden sm:inline">APP</span>
                        </button>
                    )}

                    <button onClick={() => { if(gameState.user) setShowWalletModal(true); else alert("请先登录"); }} className="flex items-center gap-2 bg-black/30 border border-yellow-500/30 rounded-full px-3 py-1.5 active:scale-95">
                       <span className="text-yellow-400 font-mono font-bold text-sm">积分</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-6 pb-32">
               <div className="w-full max-w-6xl mx-auto">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12 p-2">
                       {LOBBY_TABLES.map(table => (
                           <div key={table.id} className="relative w-full aspect-[16/10] bg-green-800/50 rounded-3xl border-4 border-yellow-900/40 shadow-xl flex items-center justify-center group hover:bg-green-800/70 transition-colors">
                               <div className="w-[70%] h-[60%] bg-green-700 rounded-2xl border-4 border-yellow-800/60 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative flex flex-col items-center justify-center">
                                   <div className="text-yellow-100/10 font-black text-3xl tracking-widest absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
                                       EVENT {table.id}
                                   </div>
                                   <div className="text-yellow-400 font-bold text-lg z-10 shadow-black drop-shadow-md text-center px-2">{table.name}</div>
                                   <div className="text-white/40 text-xs mt-1 z-10 font-mono">底分: {table.minScore}</div>
                               </div>
                               {renderSeatButton(table.carriageId, 'North', '北', 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/3')}
                               {renderSeatButton(table.carriageId, 'South', '南', 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3')}
                               {renderSeatButton(table.carriageId, 'West', '西', 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/3')}
                               {renderSeatButton(table.carriageId, 'East', '东', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/3')}
                           </div>
                       ))}
                   </div>
               </div>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent transition-transform duration-300 ${lobbySelection ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="max-w-md mx-auto">
                    <button onClick={handleEnterGame} className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-xl py-4 rounded-2xl shadow-xl shadow-red-900/40 border border-red-400/30 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <span>进入牌桌</span>
                        <span className="text-sm font-normal bg-black/20 px-2 py-0.5 rounded">
                            {lobbySelection ? `${LOBBY_TABLES.find(t => t.carriageId === lobbySelection.carriageId)?.name} - ${lobbySelection.seat === 'North' ? '北' : lobbySelection.seat === 'South' ? '南' : lobbySelection.seat === 'West' ? '西' : '东'}` : ''}
                        </span>
                    </button>
                    <p className="text-center text-white/40 text-xs mt-2">系统将自动检测场次人数，满足2人即可开赛</p>
                </div>
            </div>

            {!lobbySelection && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-md border-t border-white/5 py-4 px-4 text-center z-10">
                    <p className="text-white/50 text-xs sm:text-sm font-medium tracking-wide">
                        请选择结算时间场然后选择任意空位 · 至少2个玩家才能开始游戏
                    </p>
                </div>
            )}
        </div>
      ) : (
        <div className="h-full w-full flex flex-col items-center p-2 max-w-3xl mx-auto overflow-hidden relative">
            {/* Opponent Progress Bar (Top of Playing View) */}
            <div className="w-full bg-black/40 backdrop-blur-md border-b border-white/10 p-2 flex items-center justify-center gap-4 z-30 shrink-0 min-h-[40px]">
                {occupiedSeats.filter(s => Number(s.carriage_id) === Number(gameState.currentCarriageId) && Number(s.user_id) !== Number(gameState.user?.id)).length === 0 ? (
                    <span className="text-white/30 text-xs animate-pulse">等待其它玩家加入...</span>
                ) : (
                    occupiedSeats
                        .filter(s => Number(s.carriage_id) === Number(gameState.currentCarriageId) && Number(s.user_id) !== Number(gameState.user?.id))
                        .map(p => {
                            const pRound = p.game_round || 1;
                            const myRound = gameState.currentRound;
                            let statusColor = 'text-green-400'; // Same pace
                            let borderClass = 'border-green-500/30 bg-green-900/20';
                            
                            if (pRound < myRound) {
                                // They are slower
                                statusColor = 'text-red-400';
                                borderClass = 'border-red-500/30 bg-red-900/20';
                            } else if (pRound > myRound) {
                                // They are faster
                                statusColor = 'text-blue-400';
                                borderClass = 'border-blue-500/30 bg-blue-900/20';
                            }

                            return (
                                <div key={p.seat} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${borderClass} transition-all`}>
                                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white font-bold uppercase">
                                        {p.nickname.slice(0,1)}
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[8px] text-white/50 max-w-[40px] truncate">{p.nickname}</span>
                                        <span className={`text-[10px] font-bold ${statusColor}`}>
                                            场次 {pRound}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                )}
            </div>

            <div className="w-full flex justify-between items-end px-4 pt-2 pb-2 border-b border-white/5 bg-green-950/50 backdrop-blur-sm z-20">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="bg-yellow-600 text-white text-[10px] font-bold px-1.5 rounded">
                             {LOBBY_TABLES.find(t => t.carriageId === gameState.currentCarriageId)?.name || 'Event'}
                        </span>
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 rounded">
                             Round {gameState.currentRound}
                        </span>
                    </div>
                    <div className="text-[10px] text-white/30 mt-1">
                        当前座位: <span className="text-yellow-400 font-bold">{gameState.mySeat}</span>
                    </div>
                </div>
                <div className="font-mono text-yellow-400 font-bold text-xl">
                    {gameState.currentTableIndex + 1} <span className="text-white/30 text-sm">/ 10</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start space-y-4 px-2 w-full overflow-y-auto pb-44 pt-4">
                <HandRow title="头墩" cards={gameState.currentArrangement.top} maxCards={3} onCardClick={handleCardClick} onRowClick={() => handleRowClick('top')} selectedCardIds={selectedCardIds} className="w-full" />
                <HandRow title="中墩" cards={gameState.currentArrangement.middle} maxCards={5} onCardClick={handleCardClick} onRowClick={() => handleRowClick('middle')} selectedCardIds={selectedCardIds} className="w-full" />
                <HandRow title="尾墩" cards={gameState.currentArrangement.bottom} maxCards={5} onCardClick={handleCardClick} onRowClick={() => handleRowClick('bottom')} selectedCardIds={selectedCardIds} className="w-full" />
            </div>

            <div className="absolute bottom-6 left-0 right-0 px-3 w-full flex justify-center z-50">
                <div className="bg-black/90 backdrop-blur-xl p-2.5 rounded-2xl border border-yellow-500/20 shadow-2xl flex flex-row items-center gap-3 w-full max-w-lg">
                    <button onClick={handleSmartArrange} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-lg flex items-center justify-center gap-1.5 min-w-0">
                        <span className="truncate text-sm sm:text-base">
                            {gameState.aiSuggestions.length > 0 ? `推荐 (${gameState.currentSuggestionIndex + 1})` : "计算中..."}
                        </span>
                    </button>
                    <button onClick={submitHand} className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-green-950 font-bold text-lg py-3 rounded-lg shadow-lg transition-all active:scale-95 min-w-0">
                        提交本局
                    </button>
                </div>
            </div>
            
            <button onClick={handleQuitGame} className="absolute top-24 right-4 text-[10px] text-white/20 p-2 hover:text-white">保存退出</button>
        </div>
      )}
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
