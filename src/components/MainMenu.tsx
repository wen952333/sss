
import React, { useState } from 'react';
import { User } from '../types';

interface MainMenuProps {
  user: User | null;
  onCheckIn: () => void;
  hasCheckedIn: boolean;
  onToggleSound: () => void;
  isSoundOn: boolean;
  onBuyPoints: () => void;
  isPaying: boolean;
  onOpenGroup: () => void;
  onOpenAdmin: () => void;
  onStartGame: (mode: 'pve' | 'friends' | 'match', isNoShuffle: boolean) => void;
  isMatching: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  user,
  onCheckIn,
  hasCheckedIn,
  onToggleSound,
  isSoundOn,
  onBuyPoints,
  isPaying,
  onOpenGroup,
  onOpenAdmin,
  onStartGame,
  isMatching
}) => {
  const [activeModeModal, setActiveModeModal] = useState<'pve' | 'friends' | 'match' | null>(null);

  const handleModeSelect = (isNoShuffle: boolean) => {
    if (activeModeModal) {
      onStartGame(activeModeModal, isNoShuffle);
      setActiveModeModal(null);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-start p-4 bg-gradient-to-br from-green-900 to-green-800 text-white overflow-y-auto relative pb-20 no-scrollbar">
        {/* Header Bar */}
        <div className="w-full flex flex-col md:flex-row justify-between items-center p-2 mb-4 z-40 bg-black/20 rounded-xl backdrop-blur-sm gap-2 shrink-0">
           <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
             <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-2 border border-white/10 shadow-lg">
                <span className="text-xl">💰</span> 
                <span className="font-mono font-bold text-yellow-300">{user?.points.toLocaleString() || 0}</span>
             </div>
             
             <button 
               onClick={onCheckIn} 
               disabled={hasCheckedIn} 
               className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all border ${hasCheckedIn ? 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 border-green-400 text-white animate-pulse'}`}
             >
                {hasCheckedIn ? '已签到' : '签到+1000'}
             </button>

             <button onClick={onToggleSound} className="ml-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/20 hover:bg-white/10">
                {isSoundOn ? '🔊' : '🔇'}
             </button>
           </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex gap-2 mb-8 justify-center shrink-0">
             <button 
               onClick={onBuyPoints} 
               disabled={isPaying} 
               className={`bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold px-4 py-2 rounded-full shadow-lg border-2 border-yellow-300 transform transition active:scale-95 flex items-center gap-2 text-sm ${isPaying ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                <span className="text-lg">{isPaying ? '⏳' : '⭐️'}</span> 
                {isPaying ? '处理中...' : '2000分/1星'}
             </button>

             <button onClick={onOpenGroup} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-4 py-2 rounded-full shadow-lg border-2 border-blue-300 transform transition active:scale-95 flex items-center gap-2 text-sm">
                <span>👥</span> 群组
             </button>
             
             {user?.is_admin && (
               <button onClick={onOpenAdmin} className="bg-red-900/80 hover:bg-red-800 text-white font-bold px-3 py-2 rounded-full border border-red-500 text-sm">
                  ⚙️
               </button>
             )}
        </div>

        {/* Background */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/poker.png')] opacity-10 pointer-events-none fixed"></div>
        
        {/* Matching Overlay */}
        {isMatching && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center fixed">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500 mb-4"></div>
            <div className="text-xl font-bold animate-pulse">正在匹配玩家...</div>
          </div>
        )}
        
        {/* Mode Selection Modal */}
        {activeModeModal && (
           <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in p-4 fixed">
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 border-2 border-yellow-500/50 p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                 <button onClick={() => setActiveModeModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                 <h2 className="text-2xl font-bold text-center mb-8 text-yellow-400">选择玩法</h2>
                 <div className="flex flex-col gap-4">
                    <button onClick={() => handleModeSelect(false)} className="group bg-blue-900/50 hover:bg-blue-800 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between transition-all active:scale-95">
                       <div className="text-left"><div className="font-bold text-lg text-blue-200">经典场</div><div className="text-sm text-blue-400">入场: 100 积分</div></div>
                       <span className="text-2xl group-hover:scale-110 transition-transform">🃏</span>
                    </button>
                    <button onClick={() => handleModeSelect(true)} className="group bg-purple-900/50 hover:bg-purple-800 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between transition-all active:scale-95">
                       <div className="text-left"><div className="font-bold text-lg text-purple-200">不洗牌场</div><div className="text-sm text-purple-400">入场: 100 积分</div></div>
                       <span className="text-2xl group-hover:scale-110 transition-transform">💣</span>
                    </button>
                 </div>
              </div>
           </div>
        )}

        {/* Title */}
        <div className="z-10 text-center mb-8 animate-float mt-4 shrink-0">
           <h1 className="text-5xl md:text-7xl font-bold text-yellow-400 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] tracking-widest font-serif">Gemini 斗地主</h1>
           <p className="text-green-200 mt-2 text-sm md:text-lg">AI 驱动的智能棋牌体验</p>
           {user && <div className="mt-2 text-yellow-200 font-mono text-sm opacity-80">欢迎, {user.username}</div>}
        </div>

        {/* Main Cards */}
        <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl px-0 md:px-0">
          <button onClick={() => setActiveModeModal('pve')} className="group relative h-40 md:h-80 bg-gradient-to-b from-blue-600 to-blue-800 rounded-2xl border-4 border-blue-400 shadow-2xl overflow-hidden transform transition-all active:scale-95 hover:shadow-blue-500/50">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="text-4xl md:text-6xl mb-2 md:mb-4 group-hover:animate-bounce">🤖</div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">人机对战</h2>
              <p className="text-blue-200 text-xs md:text-sm">单机畅玩 智能对手</p>
            </div>
          </button>
          
          <button onClick={() => setActiveModeModal('friends')} className="group relative h-40 md:h-80 bg-gradient-to-b from-purple-600 to-purple-800 rounded-2xl border-4 border-purple-400 shadow-2xl overflow-hidden transform transition-all active:scale-95 hover:shadow-purple-500/50">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="text-4xl md:text-6xl mb-2 md:mb-4 group-hover:rotate-12 transition-transform">🤝</div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">牌友约战</h2>
              <p className="text-purple-200 text-xs md:text-sm">邀请好友 实时对决</p>
            </div>
          </button>
          
          <button onClick={() => setActiveModeModal('match')} className="group relative h-40 md:h-80 bg-gradient-to-b from-orange-600 to-orange-800 rounded-2xl border-4 border-orange-400 shadow-2xl overflow-hidden transform transition-all active:scale-95 hover:shadow-orange-500/50">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="text-4xl md:text-6xl mb-2 md:mb-4 group-hover:scale-110 transition-transform">⚡</div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">自动匹配</h2>
              <p className="text-orange-200 text-xs md:text-sm">极速开局 真人PK</p>
            </div>
          </button>
        </div>
        
        {/* Spacer */}
        <div className="h-8 md:hidden shrink-0"></div>
    </div>
  );
};
