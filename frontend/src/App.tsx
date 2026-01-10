import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, GamePhase, GameState, PlayerHand, Seat, TableResult, User } from './types';
import { getLocalSuggestions } from './services/suggestions';
import { HandRow } from './components/HandRow';
import { CardComponent } from './components/CardComponent';
import { getCarriage, getPlayerSubmissions, submitPlayerHand, settleGame } from './services/mockBackend';

const TEMP_GUEST_ID = 'guest_' + Math.floor(Math.random() * 10000);

const LOBBY_TABLES = [
  { id: 1, name: "今晚 20:00 结算场", carriageId: 1, minScore: 100 },
  { id: 2, name: "明日 12:00 结算场", carriageId: 2, minScore: 100 },
];

const INITIAL_STATE: GameState = {
  phase: GamePhase.LOBBY,
  user: null,
  currentCarriageId: 1,
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
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  
  // Local selection state (Optimistic)
  const [lobbySelection, setLobbySelection] = useState<{carriageId: number, seat: Seat} | null>(null);
  
  // Real-time Server Data
  const [occupiedSeats, setOccupiedSeats] = useState<ServerSeat[]>([]);
  const pollingRef = useRef<number | null>(null);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'register' | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [authForm, setAuthForm] = useState({ phone: '', nickname: '', password: '' });
  const [walletForm, setWalletForm] = useState({ 
      searchPhone: '', 
      targetUser: null as { id: number, nickname: string } | null, 
      amount: '' 
  });
  const [walletMsg, setWalletMsg] = useState('');

  // --- Initialization ---

  // 1. Load User & Setup
  useEffect(() => {
      // Trigger DB setup once
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
  }, []);

  // 2. Polling Logic
  const fetchSeats = useCallback(async () => {
      try {
          const res = await fetch('/api/game/seat');
          if (res.ok) {
            // FIX: Explicitly cast unknown to any
            const data = await res.json() as any;
            if (data.seats) setOccupiedSeats(data.seats);
          }
      } catch (e) {
          console.error("Polling error", e);
      }
  }, []);

  // Start/Stop Polling based on Phase
  useEffect(() => {
      if (gameState.phase === GamePhase.LOBBY) {
          fetchSeats(); // Immediate fetch
          pollingRef.current = window.setInterval(fetchSeats, 2000); // Poll every 2s
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
          // FIX: Explicitly cast unknown to any
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
          // FIX: Explicitly cast unknown to any
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
      await handleLeaveSeat(); // Clear seat before logging out
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
          // FIX: Explicitly cast unknown to any
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
          // FIX: Explicitly cast unknown to any
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

  // --- Seating Logic ---

  const handleSeatSelect = async (carriageId: number, seat: Seat) => {
      if (!gameState.user) {
          setShowAuthModal('login');
          return;
      }

      // If clicking same seat, treat as deselect/leave
      if (lobbySelection?.carriageId === carriageId && lobbySelection?.seat === seat) {
          await handleLeaveSeat();
          return;
      }

      // Optimistic update
      setLobbySelection({ carriageId, seat });

      // Call API
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
              // FIX: Explicitly cast unknown to any
              const data = await res.json() as any;
              alert(data.error || "抢座失败");
              setLobbySelection(null); // Revert
          }
          // Fetch immediately to confirm
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

  const handleEnterGame = () => {
      if (!lobbySelection) return;
      if (!gameState.user) {
          setShowAuthModal('login');
          return;
      }

      const { carriageId, seat } = lobbySelection;

      // FIX: Use real-time occupiedSeats from server instead of mock local storage
      const playersInCarriage = occupiedSeats.filter(s => s.carriage_id === carriageId);

      // Check if I am in the list (Server confirmation)
      const mySeatEntry = playersInCarriage.find(s => s.user_id === gameState.user!.id);

      if (!mySeatEntry || mySeatEntry.seat !== seat) {
          // Optimistic UI might show us seated, but server hasn't confirmed yet or we got kicked
          alert("正在同步座位信息，请稍候再试...");
          fetchSeats();
          return;
      }

      const count = playersInCarriage.length;

      // In Bot Fill Mode, we can essentially allow 1 player to start against bots
      if (count < 2) { 
          alert(`当前只有 ${count} 位玩家，至少需要 2 人才能开始。请等待好友加入。`);
          return;
      }

      const carriage = getCarriage(carriageId);
      if (!carriage) return alert("System Error: Local Carriage Data not found");

      // Use sequential queue so all players play tables in same order
      const queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      
      const firstTableId = queue[0];
      const cards = carriage.tables[firstTableId].hands[seat];
      const suggestions = getLocalSuggestions(cards);

      setGameState(prev => ({
        ...prev,
        phase: GamePhase.PLAYING,
        currentCarriageId: carriageId,
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

      const pid = gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID;
      const currentTableId = gameState.tableQueue[gameState.currentTableIndex];
      
      // Store locally (Mock Backend)
      submitPlayerHand(pid, {
          carriageId: gameState.currentCarriageId,
          tableId: currentTableId,
          seat: gameState.mySeat,
          hand: gameState.currentArrangement,
          timestamp: Date.now()
      });

      const nextIndex = gameState.currentTableIndex + 1;
      
      if (nextIndex >= 10) {
          alert("恭喜！本场次（车厢）所有对局已完成！请查看战报。");
          handleShowSettlement();
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


  // --- Render Helpers ---

  const MiniHandRow = ({ cards }: { cards: Card[] }) => (
      <div className="flex -space-x-4 items-center justify-center">
          {cards.map((c, i) => (
              <CardComponent 
                key={i} 
                card={c} 
                small 
                className="w-8 h-12 text-[10px] shadow-sm ring-1 ring-black/10" 
              />
          ))}
      </div>
  );

  const ReportView = () => {
      if (!gameState.settlementReport) return <div>Calculating...</div>;
      const pid = gameState.user ? `u_${gameState.user.id}` : TEMP_GUEST_ID;
      const { totalScore, details } = gameState.settlementReport;

      return (
          <div className="h-full w-full bg-green-950 flex flex-col overflow-hidden">
              <div className="shrink-0 p-4 bg-black/20 backdrop-blur-md border-b border-white/5 flex justify-between items-center z-10">
                   <div>
                       <h2 className="text-xl font-black text-yellow-400">战绩结算</h2>
                       <div className="text-xs text-white/50">共 {details.length} 局</div>
                   </div>
                   <div className="text-right">
                       <div className="text-xs text-white/50">总盈亏</div>
                       <div className={`text-2xl font-mono font-bold ${totalScore >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                           {totalScore > 0 ? '+' : ''}{totalScore}
                       </div>
                   </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
                  {details.map((tableResult, idx) => (
                      <div key={idx} className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
                          <div className="bg-white/5 px-4 py-2 flex justify-between items-center">
                              <span className="text-xs font-bold text-yellow-500/80">Table {tableResult.tableId}</span>
                              {tableResult.voided && <span className="text-xs text-red-500 border border-red-500 px-1 rounded">流局</span>}
                          </div>

                          <div className="p-2 grid grid-cols-2 gap-2">
                              {!tableResult.voided && tableResult.details.map((pDetail) => {
                                  const isMe = pDetail.playerId === pid;
                                  return (
                                      <div key={pDetail.playerId} className={`relative p-2 rounded-xl border ${isMe ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-white/5 border-white/5'}`}>
                                          <div className="flex justify-between items-center mb-1">
                                              <span className={`text-xs font-bold truncate max-w-[80px] ${isMe ? 'text-yellow-400' : 'text-white/70'}`}>
                                                  {pDetail.name}
                                              </span>
                                              <span className={`text-xs font-mono font-bold ${pDetail.score >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                  {pDetail.score > 0 ? '+' : ''}{pDetail.score}
                                              </span>
                                          </div>
                                          
                                          {pDetail.specialType ? (
                                              <div className="h-24 flex items-center justify-center bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                                                  <div className="text-center">
                                                      <div className="text-yellow-400 font-black text-lg drop-shadow-md">★ 特殊牌型 ★</div>
                                                      <div className="text-white font-bold text-sm mt-1">{pDetail.specialType}</div>
                                                  </div>
                                              </div>
                                          ) : (
                                              <div className="space-y-1 opacity-90 scale-95 origin-top-left">
                                                  <div className="flex justify-center transform scale-90 origin-left"><MiniHandRow cards={pDetail.hand.top} /></div>
                                                  <div className="flex justify-center"><MiniHandRow cards={pDetail.hand.middle} /></div>
                                                  <div className="flex justify-center"><MiniHandRow cards={pDetail.hand.bottom} /></div>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  ))}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                  <button onClick={handleQuitGame} className="w-full py-4 bg-yellow-600 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-transform">
                      返回大厅
                  </button>
              </div>
          </div>
      );
  };

  const renderSeatButton = (carriageId: number, seat: Seat, label: string, className: string) => {
      // Find who is sitting here from Server Data
      const occupant = occupiedSeats.find(s => s.carriage_id === carriageId && s.seat === seat);
      const isMe = occupant && gameState.user && occupant.user_id === gameState.user.id;
      const isSelected = lobbySelection?.carriageId === carriageId && lobbySelection?.seat === seat;
      
      return (
          <button 
              onClick={(e) => { 
                  e.stopPropagation(); 
                  // If occupied by someone else, ignore click
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
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden uppercase">
                        {occupant.nickname.slice(0, 2)}
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

      {showAuthModal && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-green-900 border border-yellow-500/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
                  <button onClick={() => setShowAuthModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
                  <h2 className="text-xl font-bold text-yellow-400 mb-6 text-center">
                      {showAuthModal === 'login' ? '账号登录' : '新用户注册'}
                  </h2>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-white/50 mb-1 block">手机号</label>
                          <input 
                              type="tel" 
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" 
                              placeholder="请输入手机号"
                              value={authForm.phone}
                              onChange={e => setAuthForm({...authForm, phone: e.target.value})}
                          />
                      </div>
                      {showAuthModal === 'register' && (
                          <div>
                              <label className="text-xs text-white/50 mb-1 block">昵称</label>
                              <input 
                                  type="text" 
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" 
                                  placeholder="游戏中显示的名称"
                                  value={authForm.nickname}
                                  onChange={e => setAuthForm({...authForm, nickname: e.target.value})}
                              />
                          </div>
                      )}
                      <div>
                          <label className="text-xs text-white/50 mb-1 block">密码 (至少6位)</label>
                          <input 
                              type="password" 
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" 
                              placeholder="设置密码"
                              value={authForm.password}
                              onChange={e => setAuthForm({...authForm, password: e.target.value})}
                          />
                      </div>
                      <button 
                          onClick={showAuthModal === 'login' ? handleLogin : handleRegister}
                          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl mt-4 active:scale-95 transition-all"
                      >
                          {showAuthModal === 'login' ? '立即登录' : '提交注册'}
                      </button>
                      
                      <div className="text-center mt-4 text-sm text-white/40">
                          {showAuthModal === 'login' ? (
                              <span onClick={() => setShowAuthModal('register')} className="underline cursor-pointer hover:text-white">没有账号？去注册</span>
                          ) : (
                              <span onClick={() => setShowAuthModal('login')} className="underline cursor-pointer hover:text-white">已有账号？去登录</span>
                          )}
                      </div>
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
      ) : gameState.phase === GamePhase.LOBBY ? (
        <div className="flex-1 flex flex-col h-full w-full relative">
            <div className="w-full h-16 bg-black/20 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-10 shrink-0">
                {gameState.user ? (
                    <button onClick={handleLogout} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center border border-white/10 font-bold text-xs">
                            {gameState.user.nickname[0]}
                        </div>
                        <div className="flex flex-col items-start">
                             <span className="text-sm font-bold leading-none">{gameState.user.nickname}</span>
                             <span className="text-[10px] text-white/40">退出登录</span>
                        </div>
                    </button>
                ) : (
                    <button onClick={() => setShowAuthModal('login')} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        </div>
                        <span className="text-sm font-bold">登录/注册</span>
                    </button>
                )}

                <button 
                    onClick={handleShowSettlement}
                    className="flex flex-col items-center group relative top-1"
                >
                    <span className="text-yellow-400 font-black text-lg leading-none tracking-wider group-hover:scale-110 transition-transform">我的战绩</span>
                    <span className="text-[10px] text-white/40 group-hover:text-white/60">
                        已完成 {gameState.submissions.length} 局
                    </span>
                </button>

                <button 
                    onClick={() => {
                        if(gameState.user) setShowWalletModal(true);
                        else alert("请先登录");
                    }} 
                    className="flex items-center gap-2 bg-black/30 hover:bg-black/50 border border-yellow-500/30 rounded-full px-3 py-1.5 transition-all active:scale-95"
                >
                   <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] text-black font-bold">$</div>
                   <div className="flex flex-col items-start leading-none">
                       <span className="text-yellow-400 font-mono font-bold text-sm">积分管理</span>
                       {gameState.user && <span className="text-[9px] text-white/60">{gameState.user.points}</span>}
                   </div>
                </button>
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
                    <button 
                        onClick={handleEnterGame}
                        className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-xl py-4 rounded-2xl shadow-xl shadow-red-900/40 border border-red-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
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
            <div className="w-full flex justify-between items-end px-4 pt-4 pb-2 border-b border-white/5 bg-green-950/50 backdrop-blur-sm z-20">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="bg-yellow-600 text-white text-[10px] font-bold px-1.5 rounded">
                             {LOBBY_TABLES.find(t => t.carriageId === gameState.currentCarriageId)?.name || '未知场次'}
                        </span>
                    </div>
                    <div className="text-[10px] text-white/30 mt-1">
                        当前座位: <span className="text-yellow-400 font-bold">{
                            gameState.mySeat === 'North' ? '北' :
                            gameState.mySeat === 'South' ? '南' :
                            gameState.mySeat === 'West' ? '西' : '东'
                        }</span>
                    </div>
                </div>
                <div className="font-mono text-yellow-400 font-bold text-xl">
                    {gameState.currentTableIndex + 1} <span className="text-white/30 text-sm">/ 10</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start space-y-4 px-2 w-full overflow-y-auto pb-44 pt-4">
                <HandRow 
                    title="头墩" 
                    cards={gameState.currentArrangement.top} 
                    maxCards={3}
                    onCardClick={handleCardClick}
                    onRowClick={() => handleRowClick('top')}
                    selectedCardIds={selectedCardIds}
                    className="w-full" 
                />
                <HandRow 
                    title="中墩" 
                    cards={gameState.currentArrangement.middle} 
                    maxCards={5}
                    onCardClick={handleCardClick}
                    onRowClick={() => handleRowClick('middle')}
                    selectedCardIds={selectedCardIds}
                    className="w-full"
                />
                <HandRow 
                    title="尾墩" 
                    cards={gameState.currentArrangement.bottom} 
                    maxCards={5}
                    onCardClick={handleCardClick}
                    onRowClick={() => handleRowClick('bottom')}
                    selectedCardIds={selectedCardIds}
                    className="w-full"
                />
            </div>

            <div className="absolute bottom-6 left-0 right-0 px-3 w-full flex justify-center z-50">
                <div className="bg-black/90 backdrop-blur-xl p-2.5 rounded-2xl border border-yellow-500/20 shadow-2xl flex flex-row items-center gap-3 w-full max-w-lg">
                    <button 
                        onClick={handleSmartArrange}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-lg flex items-center justify-center gap-1.5 min-w-0"
                    >
                        <span className="truncate text-sm sm:text-base">
                            {gameState.aiSuggestions.length > 0 ? `推荐 (${gameState.currentSuggestionIndex + 1})` : "计算中..."}
                        </span>
                    </button>
                    <button 
                        onClick={submitHand}
                        className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-green-950 font-bold text-sm sm:text-base py-3 rounded-lg shadow-lg transition-all active:scale-95 min-w-0"
                    >
                        提交本局
                    </button>
                </div>
            </div>
            
            <button 
                onClick={handleQuitGame} 
                className="absolute top-20 right-4 text-[10px] text-white/20 p-2 hover:text-white"
            >
                保存退出
            </button>
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
