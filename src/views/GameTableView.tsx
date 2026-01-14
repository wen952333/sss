
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
    onSubmitAndExit: () => void; // New Handler
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
    onSubmitAndExit,
    onQuit
}) => {
    return (
        <div className="h-full w-full flex flex-col items-center max-w-3xl mx-auto overflow-hidden relative bg-gradient-to-b from-green-900 to-green-950">
            
            {/* --- TOP CONTROL BANNER --- */}
            <div className="w-full bg-slate-900/95 backdrop-blur-md border-b border-white/10 p-2 z-50 shadow-xl flex items-center justify-between gap-2 shrink-0 h-16">
                
                {/* Button 1: Submit & Next */}
                <button 
                    onClick={onSubmit} 
                    disabled={isSubmitting}
                    className={`flex-1 h-full rounded-lg flex flex-col items-center justify-center border transition-all active:scale-95 ${isSubmitting ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-green-700 hover:bg-green-600 border-green-500 text-white'}`}
                >
                    <span className="text-[10px] sm:text-xs text-green-200">常规</span>
                    <span className="text-xs sm:text-sm font-bold leading-none">{isSubmitting ? '提交中...' : '提交并下一局'}</span>
                </button>

                {/* Button 2: Smart Arrange */}
                <button 
                    onClick={onSmartArrange} 
                    className="flex-1 h-full bg-indigo-700 hover:bg-indigo-600 border border-indigo-500 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 text-white"
                >
                    <span className="text-[10px] sm:text-xs text-indigo-200">辅助</span>
                    <span className="text-xs sm:text-sm font-bold leading-none truncate w-full px-1 text-center">
                        {gameState.aiSuggestions.length > 0 ? `智能理牌 (${gameState.currentSuggestionIndex + 1})` : "计算中..."}
                    </span>
                </button>

                {/* Button 3: Submit & End */}
                <button 
                    onClick={onSubmitAndExit} 
                    disabled={isSubmitting}
                    className="flex-1 h-full bg-red-700 hover:bg-red-600 border border-red-500 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 text-white"
                >
                    <span className="text-[10px] sm:text-xs text-red-200">不玩了</span>
                    <span className="text-xs sm:text-sm font-bold leading-none">提交并结束</span>
                </button>
            </div>

            {/* --- INFO BAR (Status & Opponents) --- */}
            <div className="w-full bg-black/40 backdrop-blur-sm border-b border-white/5 py-1 px-3 flex justify-between items-center z-40 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="bg-yellow-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">{eventName}</span>
                    <span className="text-[10px] text-white/50 truncate">
                        座位: <span className="text-yellow-400 font-bold">{gameState.mySeat}</span>
                    </span>
                </div>
                
                {/* Opponent Status Dots */}
                <div className="flex items-center gap-2">
                    {occupiedSeats.filter(s => Number(s.carriage_id) === Number(gameState.currentCarriageId) && Number(s.user_id) !== Number(gameState.user?.id)).map(p => (
                        <div key={p.seat} className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[8px] text-white font-bold" title={p.nickname}>
                            {p.nickname.slice(0,1)}
                        </div>
                    ))}
                    <div className="h-4 w-px bg-white/20 mx-1"></div>
                    <span className="font-mono text-yellow-400 font-bold text-sm">
                        局数 {gameState.currentTableIndex + 1}<span className="text-white/30 text-xs">/10</span>
                    </span>
                </div>
            </div>

            {/* --- PLAYING AREA --- */}
            <div className="flex-1 flex flex-col items-center justify-start space-y-2 px-2 w-full overflow-y-auto pt-2 pb-10">
                {/* Top Hand */}
                <HandRow 
                    title="头墩 (3张)" 
                    cards={gameState.currentArrangement.top} 
                    maxCards={3}
                    onCardClick={onCardClick}
                    onRowClick={() => onRowClick('top')}
                    selectedCardIds={selectedCardIds}
                    className="w-full scale-95 origin-top" 
                />
                
                {/* Middle Hand */}
                <HandRow 
                    title="中墩 (5张)" 
                    cards={gameState.currentArrangement.middle} 
                    maxCards={5}
                    onCardClick={onCardClick}
                    onRowClick={() => onRowClick('middle')}
                    selectedCardIds={selectedCardIds}
                    className="w-full scale-95 origin-center -mt-4"
                />
                
                {/* Bottom Hand */}
                <HandRow 
                    title="尾墩 (5张)" 
                    cards={gameState.currentArrangement.bottom} 
                    maxCards={5}
                    onCardClick={onCardClick}
                    onRowClick={() => onRowClick('bottom')}
                    selectedCardIds={selectedCardIds}
                    className="w-full scale-95 origin-bottom -mt-4"
                />
            </div>
            
            {/* Safe Area for Mobile Home Indicator */}
            <div className="h-6 w-full shrink-0"></div>
        </div>
    );
};
