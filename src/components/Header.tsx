
import React from 'react';
import { UserCircle, Coins, LogOut, History } from 'lucide-react';
import { User } from '../hooks/useAuth';

interface HeaderProps {
  currentTable: number | null;
  currentSeat: string | null;
  isInGame: boolean;
  onExit: () => void;
  onOpenRecords: () => void;
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onPointsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentTable, 
  currentSeat, 
  isInGame, 
  onExit, 
  onOpenRecords,
  user,
  onLoginClick,
  onLogoutClick,
  onPointsClick
}) => {
  const getSeatLabel = (seatId: string | null) => {
    switch(seatId) {
      case 'north': return '北';
      case 'south': return '南';
      case 'east': return '东';
      case 'west': return '西';
      default: return '';
    }
  };

  return (
    <header className="relative h-14 flex-none border-b border-gray-800 bg-[#1a1c23] flex items-center justify-between px-6 z-50 shadow-md">
      {/* Left: Login/Register or User Info */}
      <div className="flex items-center gap-2 z-10">
          {!user ? (
            <button 
              onClick={onLoginClick}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
            >
                <UserCircle size={20} className="group-hover:text-yellow-500 transition-colors" />
                <span className="text-sm font-medium">注册 / 登录</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-yellow-500/90 font-bold bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                <UserCircle size={18} />
                <span className="text-sm">{user.nickname}</span>
              </div>
              <button onClick={onLogoutClick} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                注销
              </button>
            </div>
          )}
      </div>

      {/* Center: Records */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
         <button 
           onClick={onOpenRecords}
           className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-all group px-5 py-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-yellow-500/20 active:scale-95"
         >
            <div className="relative">
              <History size={18} className="group-hover:rotate-12 transition-transform" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            <span className="text-sm font-bold tracking-wide">战绩记录</span>
         </button>
      </div>

      {/* Right: Points & Game Controls */}
      <div className="flex items-center gap-3 sm:gap-4 text-sm text-gray-400 z-10">
          {/* Points Management - Only visible if logged in */}
          {user && (
            <button 
              onClick={onPointsClick}
              className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors bg-yellow-500/10 hover:bg-yellow-500/20 px-3 py-1.5 rounded-full border border-yellow-500/20"
            >
                <Coins size={16} />
                <span className="font-bold text-xs sm:text-sm">{user.points} 积分</span>
            </button>
          )}

          <div className="w-px h-4 bg-gray-700 mx-1 hidden sm:block"></div>

          {currentTable && currentSeat && (
            <span className="hidden sm:inline-block bg-gray-800/80 px-3 py-1 rounded-full border border-gray-700/50 text-xs text-gray-300">
              {currentTable}号桌 • {getSeatLabel(currentSeat)}
            </span>
          )}
          {isInGame && (
            <button onClick={onExit} className="flex items-center gap-1 hover:text-red-400 transition-colors">
              <LogOut size={16} /> <span className="hidden sm:inline">退出</span>
            </button>
          )}
      </div>
    </header>
  );
};
