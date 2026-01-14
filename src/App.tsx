
import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, GameState, Seat } from './types';

// Views
import { LobbyView } from './views/LobbyView';
import { GameTableView } from './views/GameTableView';
import { SettlementView } from './views/SettlementView';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useWallet } from './hooks/useWallet';
import { useSeats } from './hooks/useSeats';
import { useGameLogic } from './hooks/useGameLogic';
import { getCarriage } from './services/mockBackend';
import { getLocalSuggestions } from './services/suggestions';

// CONFIG
const LOBBY_TABLES = [
  { id: 1, name: "1号桌", carriageId: 1, minScore: 100 },
  { id: 2, name: "2号桌", carriageId: 2, minScore: 100 }, 
];

const INITIAL_STATE: GameState = {
  phase: GamePhase.LOBBY,
  user: null,
  currentCarriageId: 1,
  currentRound: 1, 
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

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  
  // --- Hooks Initialization ---
  const { 
      showAuthModal, setShowAuthModal, authForm, setAuthForm, 
      handleLogin, handleRegister, handleLogout, syncUserData 
  } = useAuth(setGameState);

  const {
      showWalletModal, setShowWalletModal, walletForm, setWalletForm, walletMsg,
      handleSearchUser, handleTransfer
  } = useWallet(gameState, setGameState);

  const { occupiedSeats, fetchSeats, setOccupiedSeats } = useSeats(gameState.phase);

  const {
      selectedCardIds, lobbySelection, isSubmitting,
      handleSeatSelect, handleLeaveSeat, handleEnterGame, handleQuitGame,
      handleCardClick, handleRowClick, handleSmartArrange, submitHand, submitAndExit, setLobbySelection
  } = useGameLogic({
      gameState, setGameState, occupiedSeats, setOccupiedSeats, 
      syncUserData: () => syncUserData(gameState.user), 
      setShowAuthModal, fetchSeats, lobbyTables: LOBBY_TABLES
  });

  // --- RECONNECTION LOGIC ---
  // Runs once on mount (or when user logs in) to check if they have an active game.
  useEffect(() => {
      const checkReconnection = async () => {
          // 1. Get Local User
          const cachedUser = localStorage.getItem('shisanshui_user');
          if (!cachedUser) return;
          
          let userObj = null;
          try { userObj = JSON.parse(cachedUser); } catch(e){}
          if (!userObj) return;

          // 2. Fetch Latest Seats from Server
          try {
              const res = await fetch('/api/game/seat');
              if (!res.ok) return;
              const data = await res.json() as any;
              const seats = data.seats || [];
              setOccupiedSeats(seats);

              // 3. Find My Seat
              const mySeatInfo = seats.find((s: any) => Number(s.user_id) === Number(userObj.id));

              if (mySeatInfo) {
                  // SCENARIO A: User is Seated -> RECONNECT
                  console.log("Found active seat, reconnecting...", mySeatInfo);
                  
                  // Restore Game State
                  const cId = mySeatInfo.carriage_id;
                  const round = mySeatInfo.game_round || 1;
                  const seat = mySeatInfo.seat as Seat; // Explicitly cast to Seat

                  // Load Deck Data (Mock or Real)
                  const deckId = (round % 20) || 20;
                  const carriageData = getCarriage(deckId); 
                  
                  if (carriageData) {
                      // We need to know which table within the round? 
                      // Simplify: Always start at Table 0 of that Round for re-connection or verify specific progress.
                      // Ideally backend tells us "pending table index". 
                      // For now, assume start of that Round's loop.
                      
                      const queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5); 
                      const cards = carriageData.tables[queue[0]].hands[seat];
                      const suggestions = getLocalSuggestions(cards);

                      setGameState(prev => ({
                          ...prev,
                          user: userObj, // Ensure user is logged in state
                          phase: GamePhase.PLAYING,
                          currentCarriageId: cId,
                          currentRound: round,
                          currentTableIndex: 0,
                          tableQueue: queue,
                          mySeat: seat,
                          currentCards: cards,
                          currentArrangement: suggestions[0],
                          aiSuggestions: suggestions,
                          currentSuggestionIndex: 0
                      }));
                      return; // Done reconnecting
                  }
              } 
              
              // SCENARIO B: No Seat Found -> Stay in Lobby (Standard)
              // This covers the case where "C finished the game" -> A's seat was removed by C's completion or timeout.
              console.log("No active seat found. Staying in Lobby.");

          } catch(e) {
              console.error("Reconnection check failed", e);
          }
      };

      checkReconnection();
  }, []); // Empty dependency array = runs on mount

  // --- PWA Install State (Existing) ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false); 

  useEffect(() => {
      fetch('/api/setup').catch(() => {});
      const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
      window.addEventListener('beforeinstallprompt', handler);
      const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (isIosDevice && !isStandalone) setIsIOS(true);
      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
      if (isIOS) setShowIOSPrompt(true);
      else if (installPrompt) {
          installPrompt.prompt();
          const { outcome } = await installPrompt.userChoice;
          if (outcome === 'accepted') { setInstallPrompt(null); setShowInstallBanner(false); }
      }
  };

  const handleShowSettlement = async () => {
      if (!gameState.user) return alert("请先登录");
      syncUserData(gameState.user);
      try {
          const res = await fetch(`/api/game/history?carriageId=${gameState.currentCarriageId}`);
          if (!res.ok) throw new Error("Failed");
          const data = await res.json() as any;
          setGameState(prev => ({ 
              ...prev, 
              phase: GamePhase.SETTLEMENT_VIEW, 
              settlementReport: { totalScore: 0, details: data.details || [] } // Recalc total locally if needed or rely on API
          }));
      } catch(e) { console.error(e); alert("无法获取战绩"); }
  };

  const fetchHistory = async () => {
      if (!gameState.user) return;
      try {
          const res = await fetch(`/api/game/history?carriageId=${gameState.currentCarriageId}`);
          if (!res.ok) throw new Error("Failed");
          const data = await res.json() as any;
          setGameState(prev => ({ 
              ...prev, 
              settlementReport: { totalScore: 0, details: data.details || [] } 
          }));
      } catch(e) {}
  };

  // --- Main Render ---

  return (
    <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 font-sans flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 opacity-5 pointer-events-none z-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>

      {showIOSPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
            <div className="bg-green-900 border border-white/20 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-pop-in mb-8">
                 <div className="text-center">
                     <h3 className="text-xl font-bold text-yellow-400 mb-2">安装到手机</h3>
                     <p className="text-white/70 text-sm mb-4">在 iOS Safari 上，请点击底部的 <strong className="text-white">分享图标</strong><br/>然后选择 <strong className="text-white">添加到主屏幕</strong>。</p>
                     <button onClick={() => setShowIOSPrompt(false)} className="text-yellow-400 font-bold text-sm">我知道了</button>
                 </div>
            </div>
        </div>
      )}

      {showInstallBanner && installPrompt && !isIOS && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-green-900 border-t border-yellow-500/50 p-4 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between max-w-md mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg p-1">
                        <img src="/icon-192.png" className="w-full h-full object-contain" alt="App Icon"/>
                    </div>
                    <div className="text-left">
                        <div className="text-white font-bold text-sm">安装十三水 APP</div>
                        <div className="text-white/60 text-xs">获得更流畅的全屏游戏体验</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={() => setShowInstallBanner(false)} className="text-white/40 text-xs px-2">关闭</button>
                     <button onClick={handleInstallClick} className="bg-yellow-500 text-green-900 font-bold text-xs px-4 py-2 rounded-full shadow-lg">安装</button>
                </div>
            </div>
        </div>
      )}

      {showAuthModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
                          <label className="text-xs text-white/50 mb-1 block">密码 (至少6位)</label>
                          <input type="password" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                      </div>
                      <button onClick={showAuthModal === 'login' ? handleLogin : handleRegister} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl mt-4 active:scale-95 transition-all">{showAuthModal === 'login' ? '立即登录' : '提交注册'}</button>
                      
                      <div className="text-center mt-4 text-sm text-white/40">
                          {showAuthModal === 'login' ? (<span onClick={() => setShowAuthModal('register')} className="underline cursor-pointer hover:text-white">没有账号？去注册</span>) : (<span onClick={() => setShowAuthModal('login')} className="underline cursor-pointer hover:text-white">已有账号？去登录</span>)}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showWalletModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-green-900 border border-yellow-500/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
                   <button onClick={() => setShowWalletModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
                   <h2 className="text-xl font-bold text-yellow-400 mb-2 text-center">积分管理</h2>
                   <p className="text-center text-white/50 text-sm mb-6">当前积分: <span className="text-white font-mono">{gameState.user?.points || 0}</span></p>
                   <div className="space-y-4">
                       <div className="flex gap-2">
                           <input type="tel" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-yellow-500" placeholder="输入对方手机号" value={walletForm.searchPhone} onChange={e => setWalletForm({...walletForm, searchPhone: e.target.value})} />
                           <button onClick={handleSearchUser} className="bg-white/10 px-4 rounded-lg hover:bg-white/20">搜索</button>
                       </div>
                       {walletMsg && <div className="text-xs text-center text-red-400">{walletMsg}</div>}
                       {walletForm.targetUser && (
                           <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                               <div className="text-sm text-white/70">接收人: <span className="text-yellow-400 font-bold">{walletForm.targetUser.nickname}</span></div>
                               <input type="number" className="w-full mt-2 bg-black/40 border border-white/10 rounded px-2 py-1 text-white outline-none" placeholder="转账金额" value={walletForm.amount} onChange={e => setWalletForm({...walletForm, amount: e.target.value})} />
                               <button onClick={handleTransfer} className="w-full mt-3 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-sm">确认转账</button>
                           </div>
                       )}
                   </div>
              </div>
          </div>
      )}

      {/* --- Main View Switcher --- */}
      {gameState.phase === GamePhase.SETTLEMENT_VIEW ? (
          <SettlementView 
              report={gameState.settlementReport} 
              currentUser={gameState.user}
              onBack={() => setGameState(prev => ({...prev, phase: GamePhase.LOBBY}))}
              onRefresh={async () => await fetchHistory()}
          />
      ) : gameState.phase === GamePhase.LOBBY ? (
          <LobbyView 
              gameState={gameState}
              lobbyTables={LOBBY_TABLES}
              occupiedSeats={occupiedSeats}
              lobbySelection={lobbySelection}
              installPrompt={installPrompt}
              isIOS={isIOS}
              onLogout={() => handleLogout(() => handleLeaveSeat())}
              onAuthClick={() => setShowAuthModal('login')}
              onShowSettlement={handleShowSettlement}
              onShowWallet={() => { if(gameState.user) { syncUserData(gameState.user); setShowWalletModal(true); } else alert("请先登录"); }}
              onInstallApp={handleInstallClick}
              onSeatSelect={handleSeatSelect}
              onEnterGame={handleEnterGame}
          />
      ) : (
          <GameTableView 
              gameState={gameState}
              eventName={LOBBY_TABLES.find(t => t.carriageId === gameState.currentCarriageId)?.name || '未知场次'}
              occupiedSeats={occupiedSeats}
              selectedCardIds={selectedCardIds}
              isSubmitting={isSubmitting}
              onCardClick={handleCardClick}
              onRowClick={handleRowClick}
              onSmartArrange={handleSmartArrange}
              onSubmit={submitHand}
              onSubmitAndExit={submitAndExit}
              onQuit={handleQuitGame}
          />
      )}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
