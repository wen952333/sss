
import React from 'react';
import { GameState, Seat } from '../types';

interface ServerSeat {
    carriage_id: number;
    seat: Seat;
    user_id: number;
    nickname: string;
    game_round?: number; 
}

interface LobbyViewProps {
    gameState: GameState;
    lobbyTables: { id: number, name: string, carriageId: number, minScore: number }[];
    occupiedSeats: ServerSeat[];
    lobbySelection: {carriageId: number, seat: Seat} | null;
    installPrompt: any;
    isIOS: boolean;
    
    // Handlers
    onLogout: () => void;
    onAuthClick: () => void;
    onShowSettlement: () => void;
    onShowWallet: () => void;
    onInstallApp: () => void;
    onSeatSelect: (carriageId: number, seat: Seat) => void;
    onEnterGame: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ 
    gameState, 
    lobbyTables, 
    occupiedSeats, 
    lobbySelection,
    installPrompt,
    isIOS,
    onLogout,
    onAuthClick,
    onShowSettlement,
    onShowWallet,
    onInstallApp,
    onSeatSelect,
    onEnterGame
}) => {

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
                    onSeatSelect(carriageId, seat); 
                }}
                className={`absolute w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all shadow-lg backdrop-blur-sm group ${className} ${occupant ? (isMe ? 'bg-yellow-600 border-yellow-400 scale-110 shadow-yellow-500/50 z-20' : 'bg-red-900/80 border-red-500/50 scale-100 cursor-not-allowed') : (isSelected ? 'bg-yellow-500/50 border-yellow-200 animate-pulse' : 'bg-black/40 border-white/10 hover:bg-yellow-600/80 hover:border-yellow-400 hover:scale-110')}`}
            >
                {occupant ? (
                    <>
                      <div className="relative w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden uppercase">{occupant.nickname.slice(0, 2)}</div>
                      <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[8px] px-1 rounded-full border border-white/20 shadow-sm scale-90">{roundNum}</div>
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
        <div className="flex-1 flex flex-col h-full w-full relative">
            <div className="w-full h-16 bg-black/20 backdrop-blur-md border-b border-white/5 grid grid-cols-3 items-center px-4 z-10 shrink-0">
                <div className="flex justify-start">
                    {gameState.user ? (
                        <button onClick={onLogout} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center border border-white/10 font-bold text-xs shrink-0">{gameState.user.nickname[0]}</div>
                            <div className="flex flex-col items-start overflow-hidden"><span className="text-sm font-bold leading-none truncate max-w-[80px]">{gameState.user.nickname}</span><span className="text-[10px] text-white/40">退出</span></div>
                        </button>
                    ) : (
                        <button onClick={onAuthClick} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"><span className="text-sm font-bold">登录/注册</span></button>
                    )}
                </div>
                <div className="flex justify-center">
                    <button onClick={onShowSettlement} className="flex flex-col items-center group"><span className="text-yellow-400 font-black text-lg leading-none tracking-wider group-hover:scale-110 transition-transform drop-shadow-md">我的战绩</span><span className="text-[9px] text-white/40 group-hover:text-white/60">点击查看</span></button>
                </div>
                <div className="flex justify-end items-center gap-2">
                    {(installPrompt || isIOS) && (
                        <button onClick={onInstallApp} className="flex items-center gap-1.5 bg-yellow-600 border border-yellow-400 text-white rounded-full px-3 py-1 shadow-lg hover:bg-yellow-500 transition-all animate-pulse">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span className="text-[10px] font-bold">APP</span>
                        </button>
                    )}
                    <button onClick={onShowWallet} className="flex items-center gap-2 bg-black/30 border border-yellow-500/30 rounded-full px-3 py-1.5 active:scale-95"><span className="text-yellow-400 font-mono font-bold text-sm">积分</span></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-6 pb-32">
               <div className="w-full max-w-6xl mx-auto">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12 p-2">
                       {lobbyTables.map(table => (
                           <div key={table.id} className="relative w-full aspect-[16/10] bg-green-800/50 rounded-3xl border-4 border-yellow-900/40 shadow-xl flex items-center justify-center group hover:bg-green-800/70 transition-colors">
                               <div className="w-[70%] h-[60%] bg-green-700 rounded-2xl border-4 border-yellow-800/60 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative flex flex-col items-center justify-center">
                                   <div className="text-yellow-100/10 font-black text-3xl tracking-widest absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">无尽模式</div>
                                   <div className="text-yellow-400 font-bold text-lg z-10 shadow-black drop-shadow-md text-center px-2">{table.name}</div>
                                   <div className="text-white/40 text-xs mt-1 z-10 font-mono">{table.minScore} 积分才能进入</div>
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
                    <button onClick={onEnterGame} className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-xl py-4 rounded-2xl shadow-xl shadow-red-900/40 border border-red-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"><span>进入牌桌</span><span className="text-sm font-normal bg-black/20 px-2 py-0.5 rounded">{lobbySelection ? `${lobbyTables.find(t => t.carriageId === lobbySelection.carriageId)?.name} - ${lobbySelection.seat}` : ''}</span></button>
                </div>
            </div>
        </div>
    );
};
