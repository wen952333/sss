
import React, { useState, useEffect } from 'react';
import { GamePhase, GameState } from './types';

// Views
import { LobbyView } from './views/LobbyView';
import { GameTableView } from './views/GameTableView';
import { SettlementView } from './views/SettlementView';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useWallet } from './hooks/useWallet';
import { useSeats } from './hooks/useSeats';
import { useGameLogic } from './hooks/useGameLogic';

// CONFIG
const LOBBY_TABLES = [
  { id: 1, name: "无尽乱序场 (20:00)", carriageId: 1, minScore: 300 },
  { id: 2, name: "无尽乱序场 (12:00)", carriageId: 1, minScore: 300 }, 
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
      handleCardClick, handleRowClick, handleSmartArrange, submitHand
  } = useGameLogic({
      gameState, setGameState, occupiedSeats, setOccupiedSeats, 
      syncUserData: () => syncUserData(gameState.user), 
      setShowAuthModal, fetchSeats, lobbyTables: LOBBY_TABLES
  });

  // --- PWA Install State ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false); 

  useEffect(() => {
      fetch('/api/setup').catch(() => {});

      const cachedUser = localStorage.getItem('shisanshui_user');
      if (cachedUser) {
          try {
              const u = JSON.parse(cachedUser);
              setGameState(prev => ({ ...prev, user: u }));
          } catch(e) {}
      }
      
      const handler = (e: any) => {
        e.preventDefault(); 
        setInstallPrompt(e);
        setShowInstallBanner(true);
      };
      window.addEventListener('beforeinstallprompt', handler);

      const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (isIosDevice && !isStandalone) {
          setIsIOS(true);
      }

      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
      if (isIOS) {
          setShowIOSPrompt(true);
      } else if (installPrompt) {
          installPrompt.prompt();
          const { outcome } = await installPrompt.userChoice;
          if (outcome === 'accepted') {
              setInstallPrompt(null);
              setShowInstallBanner(false);
          }
      }
  };

  const handleShowSettlement = async () => {
      if (!gameState.user) return alert("请先登录");
      syncUserData(gameState.user);

      try {
          const res = await fetch(`/api/game/history?carriageId=${gameState.currentCarriageId}`);
          if (!res.ok) throw new Error("Failed");
          const data = await res.json() as any;
          const details = data.details || [];
          
          let myTotal = 0;
          details.forEach((t: any) => {
              if(!t.voided && t.scores) {
                  myTotal += (t.scores[`u_${gameState.user?.id}`] || 0);
              }
          });

          setGameState(prev => ({ 
              ...prev, 
              phase: GamePhase.SETTLEMENT_VIEW, 
              settlementReport: { 
                  totalScore: myTotal, 
                  details: details 
              } 
          }));

      } catch(e) {
          console.error(e);
          alert("无法获取战绩，请检查网络");
      }
  };

  const fetchHistory = async () => {
      if (!gameState.user) return;
      try {
          const res = await fetch(`/api/game/history?carriageId=${gameState.currentCarriageId}`);
          if (!res.ok) throw new Error("Failed");
          const data = await res.json() as any;
          
          let myTotal = 0;
          const details = data.details || [];
          details.forEach((t: any) => {
              if(!t.voided && t.scores) {
                  myTotal += (t.scores[`u_${gameState.user?.id}`] || 0);
              }
          });

          setGameState(prev => ({ 
              ...prev, 
              settlementReport: { 
                  totalScore: myTotal, 
                  details: details 
              } 
          }));
      } catch(e) {
          console.error(e);
      }
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
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
