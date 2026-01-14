
import React from 'react';
import { Card, GameState, Seat } from '../types';
import { HandRow } from '../components/HandRow';

interface ServerSeat {
    carriage_id: number;
    seat: Seat;
    user_id: number;
    nickname: string;
    game_round?: number; 
}

interface GameTableViewProps {
    gameState: GameState;
    eventName: string;
    occupiedSeats: ServerSeat[];
    selectedCardIds: string[];
    isSubmitting: boolean;
    
    // Handlers
    onCardClick: (card: Card) => void;
    onRowClick: (segment: 'top' | 'middle' | 'bottom') => void;
    onSmartArrange: () => void;
    onSubmit: () => void;
    onQuit: () => void;
}

export const GameTableView: React.FC<GameTableViewProps> = ({ 
    gameState, 
    eventName,
    occupiedSeats, 
    selectedCardIds, 
    isSubmitting,
    onCardClick,
    onRowClick,
    onSmartArrange,
    onSubmit,
    onQuit
}) => {
    return (
        <div className="h-full w-full flex flex-col items-center p-2 max-w-3xl mx-auto overflow-hidden relative">
            <div className="w-full bg-black/40 backdrop-blur-md border-b border-white/10 p-2 flex items-center justify-center gap-4 z-30 shrink-0 min-h-[40px]">
                {occupiedSeats.filter(s => Number(s.carriage_id) === Number(gameState.currentCarriageId) && Number(s.user_id) !== Number(gameState.user?.id)).length === 0 ? (<span className="text-white/30 text-xs animate-pulse">等待其它玩家加入...</span>) : (occupiedSeats.filter(s => Number(s.carriage_id) === Number(gameState.currentCarriageId) && Number(s.user_id) !== Number(gameState.user?.id)).map(p => (<div key={p.seat} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-green-500/30 bg-green-900/20 transition-all"><div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white font-bold uppercase">{p.nickname.slice(0,1)}</div><div className="flex flex-col leading-none"><span className="text-[8px] text-white/50 max-w-[40px] truncate">{p.nickname}</span></div></div>)))}
            </div>
            {gameState.user && gameState.user.points < 200 && gameState.user.points >= 100 && (
                <div className="w-full bg-yellow-900/80 text-yellow-200 text-xs text-center py-1 absolute top-[40px] z-30 border-b border-yellow-500/30">
                    ⚠️ 积分即将不足 (当前: {gameState.user.points})，低于 100 将被暂停功能。
                </div>
            )}
            <div className="w-full flex justify-between items-end px-4 pt-2 pb-2 border-b border-white/5 bg-green-950/50 backdrop-blur-sm z-20">
                <div>
                    <div className="flex items-center gap-2"><span className="bg-yellow-600 text-white text-[10px] font-bold px-1.5 rounded">{eventName}</span><span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 rounded">第 {(gameState.currentRound - 1) * 10 + (gameState.currentTableIndex + 1)} 局</span></div>
                    <div className="text-[10px] text-white/30 mt-1">当前座位: <span className="text-yellow-400 font-bold">{gameState.mySeat}</span></div>
                </div>
                <div className="font-mono text-yellow-400 font-bold text-xl">{gameState.currentTableIndex + 1} <span className="text-white/30 text-sm">/ 10</span></div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-start space-y-4 px-2 w-full overflow-y-auto pb-44 pt-4">
                <HandRow title="头墩" cards={gameState.currentArrangement.top} maxCards={3} onCardClick={onCardClick} onRowClick={() => onRowClick('top')} selectedCardIds={selectedCardIds} className="w-full" />
                <HandRow title="中墩" cards={gameState.currentArrangement.middle} maxCards={5} onCardClick={onCardClick} onRowClick={() => onRowClick('middle')} selectedCardIds={selectedCardIds} className="w-full" />
                <HandRow title="尾墩" cards={gameState.currentArrangement.bottom} maxCards={5} onCardClick={onCardClick} onRowClick={() => onRowClick('bottom')} selectedCardIds={selectedCardIds} className="w-full" />
            </div>
            <div className="absolute bottom-6 left-0 right-0 px-3 w-full flex justify-center z-50">
                <div className="bg-black/90 backdrop-blur-xl p-2.5 rounded-2xl border border-yellow-500/20 shadow-2xl flex flex-row items-center gap-3 w-full max-w-lg">
                    <button onClick={onSmartArrange} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-lg flex items-center justify-center gap-1.5 min-w-0"><span className="truncate text-sm sm:text-base">{gameState.aiSuggestions.length > 0 ? `推荐 (${gameState.currentSuggestionIndex + 1})` : "计算中..."}</span></button>
                    <button onClick={onSubmit} disabled={isSubmitting} className={`flex-1 text-green-950 font-bold text-sm sm:text-lg py-3 rounded-lg shadow-lg transition-all active:scale-95 min-w-0 flex items-center justify-center ${isSubmitting ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400'}`}>
                        {isSubmitting ? (
                            <><span className="animate-spin mr-2">⟳</span> 提交中...</>
                        ) : "提交并开始下一局"}
                    </button>
                </div>
            </div>
            <button onClick={onQuit} className="absolute top-24 right-4 text-[10px] text-white/20 p-2 hover:text-white">保存退出</button>
        </div>
    );
};
