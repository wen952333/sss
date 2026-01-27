
import React, { useState } from 'react';
import { GameState, GamePhase, PlayerRole, Card } from '../types';
import { PlayerArea } from './PlayerArea';
import { CardComponent } from './CardComponent';
import { getSmartHint } from '../services/geminiService';
import { sortCards } from '../utils/gameRules';

interface GameBoardProps {
  gameState: GameState;
  myPlayerId: number;
  onBid: (claim: boolean) => void;
  onPlayTurn: (cards: Card[]) => void;
  onExit: () => void;
  onRestart: () => void;
  onToggleSound: () => void;
  isSoundOn: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  myPlayerId, 
  onBid, 
  onPlayTurn, 
  onExit,
  onRestart,
  onToggleSound,
  isSoundOn 
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [aiHint, setAiHint] = useState<string>("");
  const [isGettingHint, setIsGettingHint] = useState(false);

  // Helper to get relative players for UI positioning
  // 视角旋转逻辑：
  // 如果我是 0: pMe=0, pRight=1, pLeft=2
  // 如果我是 1: pMe=1, pRight=2, pLeft=0
  // 如果我是 2: pMe=2, pRight=0, pLeft=1
  // 这确保了逆时针/顺时针的视觉顺序正确
  const getRelativePlayer = (offset: number) => {
    const idx = (myPlayerId + offset) % 3;
    return gameState.players[idx];
  };

  const pMe = gameState.players[myPlayerId];
  const pRight = getRelativePlayer(1);
  const pLeft = getRelativePlayer(2);

  // Interaction Handlers
  const toggleCardSelection = (cardId: string) => {
    if (gameState.phase !== GamePhase.Playing || gameState.currentTurnIndex !== myPlayerId) return;
    
    setSelectedCardIds(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleHumanPlay = () => {
    const cards = pMe.hand.filter(c => selectedCardIds.includes(c.id));
    onPlayTurn(sortCards(cards));
    setSelectedCardIds([]);
    setAiHint("");
  };

  const handleHumanPass = () => {
    onPlayTurn([]);
    setSelectedCardIds([]);
    setAiHint("");
  };

  const requestHint = async () => {
    setIsGettingHint(true);
    const advice = await getSmartHint(
      pMe.hand, 
      gameState.lastMove, 
      gameState.landlordCards,
      pMe.role || "农民"
    );
    setAiHint(advice);
    setIsGettingHint(false);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-between p-2 md:p-4 overflow-hidden bg-gradient-to-br from-green-900 to-green-800 font-sans fixed inset-0">
      
      {/* Top Bar */}
      <div className="w-full flex justify-between items-start z-30">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 md:gap-2 bg-black/20 p-1 md:p-2 rounded-lg backdrop-blur-sm shadow-md border border-white/5">
             <div className="text-xs text-gray-300 mb-1 w-full text-center uppercase tracking-wider hidden md:block">底牌</div>
             <div className="flex gap-1">
               {gameState.landlordCards.length > 0 ? (
                 gameState.landlordCards.map(c => (
                   <CardComponent key={c.id} card={c} small hidden={gameState.phase === GamePhase.Dealing || gameState.phase === GamePhase.Bidding} />
                 ))
               ) : (
                 [1,2,3].map(i => <div key={i} className="w-8 h-12 md:w-10 md:h-14 bg-white/10 rounded border border-white/20"></div>)
               )}
             </div>
          </div>
          <div className="bg-black/30 text-white text-[10px] md:text-xs px-2 py-1 rounded-full text-center font-mono border border-white/5">
            底分:{gameState.baseScore} 倍:{gameState.multiplier}
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
           <h1 className="text-lg md:text-2xl font-bold text-yellow-400 drop-shadow-md">Gemini 斗地主</h1>
           <button onClick={onExit} className="text-xs text-red-300 hover:text-red-100 underline mb-1">退出游戏</button>
           <button onClick={onToggleSound} className="text-lg md:text-xl bg-black/20 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/40 transition-colors">
             {isSoundOn ? '🔊' : '🔇'}
           </button>
        </div>
      </div>

      {/* Main Game Grid */}
      <div className="flex-1 w-full max-w-6xl grid grid-cols-3 grid-rows-[1fr_auto] gap-2 md:gap-4 mt-2">
        
        {/* Left Player */}
        <div className="col-span-1 row-span-1 flex items-center justify-start">
            <PlayerArea player={pLeft} gameState={gameState} position="left" />
        </div>

        {/* Center (Table Notifications & Bidding) */}
        <div className="col-span-1 row-span-1 flex flex-col items-center justify-center relative z-20">
           
           {/* Game Over Modal */}
           {gameState.phase === GamePhase.GameOver && (
             <div className="absolute bg-black/80 p-6 md:p-8 rounded-xl text-center backdrop-blur-md animate-bounce-in z-50 border-2 border-yellow-500 shadow-2xl min-w-[280px]">
               <h2 className="text-3xl md:text-5xl font-bold mb-2 md:mb-4 text-white drop-shadow-lg">
                 {gameState.winnerId === myPlayerId ? "🎉 胜利! 🎉" : "😢 失败..."}
               </h2>
               <p className="mb-2 text-gray-300 text-base md:text-xl">
                 赢家: {gameState.players[gameState.winnerId!].name}
               </p>
               <div className="mb-4 md:mb-6 text-yellow-300 font-mono text-sm md:text-lg bg-white/10 p-2 rounded">
                 结算: {gameState.baseScore * gameState.multiplier * (pMe.role === PlayerRole.Landlord ? 2 : 1)} 分
               </div>
               <div className="flex flex-col md:flex-row gap-2 md:gap-4 justify-center">
                  <button onClick={onRestart} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-full transform transition active:scale-95 shadow-lg">再来一局</button>
                  <button onClick={onExit} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-full transform transition active:scale-95 shadow-lg">返回大厅</button>
               </div>
             </div>
           )}

           {/* Bidding Controls */}
           {gameState.phase === GamePhase.Bidding && gameState.currentTurnIndex === myPlayerId && (
             <div className="flex gap-2 md:gap-4 z-50 animate-bounce-in flex-col md:flex-row">
               <button onClick={() => onBid(true)} className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 md:py-3 px-6 md:px-8 rounded-full shadow-lg border-2 border-orange-300 transform transition active:scale-95 text-sm md:text-base">
                 叫地主
               </button>
               <button onClick={() => onBid(false)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 md:py-3 px-6 md:px-8 rounded-full shadow-lg border-2 border-gray-400 transform transition active:scale-95 text-sm md:text-base">
                 不叫
               </button>
             </div>
           )}
        </div>

        {/* Right Player */}
        <div className="col-span-1 row-span-1 flex items-center justify-end">
            <PlayerArea player={pRight} gameState={gameState} position="right" />
        </div>

        {/* Bottom Player (Me) & Controls */}
        <div className="col-span-3 row-start-2 flex flex-col items-center justify-end pb-4 md:pb-4 relative z-40">
          
          {/* Controls Bar */}
          <div className="w-full max-w-2xl flex items-center justify-center gap-2 md:gap-4 mb-2 md:mb-4 min-h-[40px] md:min-h-[48px]">
             {gameState.phase === GamePhase.Playing && gameState.currentTurnIndex === myPlayerId && (
               <>
                 <button 
                   onClick={handleHumanPass} 
                   className={`px-4 md:px-6 py-1.5 md:py-2 rounded-full font-bold shadow-lg transition-colors text-sm md:text-base ${(!gameState.lastMove || gameState.lastMove.playerId === myPlayerId) ? 'bg-gray-500 cursor-not-allowed opacity-50' : 'bg-red-600 hover:bg-red-500 text-white border border-red-400'}`}
                   disabled={!gameState.lastMove || gameState.lastMove.playerId === myPlayerId}
                 >不出</button>
                 
                 <button 
                   onClick={handleHumanPlay}
                   disabled={selectedCardIds.length === 0}
                   className={`px-6 md:px-8 py-1.5 md:py-2 rounded-full font-bold shadow-lg transition-transform active:scale-95 border text-sm md:text-base ${selectedCardIds.length > 0 ? 'bg-green-600 hover:bg-green-500 text-white border-green-400' : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'}`}
                 >出牌</button>

                 <button onClick={requestHint} disabled={isGettingHint} className="ml-2 md:ml-8 flex items-center gap-1 md:gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-full shadow-lg border border-purple-400/30 transition-all active:scale-95 text-xs md:text-sm">
                    {isGettingHint ? <span className="animate-spin">⌛</span> : <span>💡 AI提示</span>}
                 </button>
               </>
             )}
          </div>

          {/* AI Hint Popover */}
          {aiHint && (
             <div className="mb-2 md:mb-4 bg-purple-900/95 border border-purple-500/50 text-purple-100 p-2 md:p-3 rounded-lg text-xs md:text-sm max-w-xs md:max-w-lg text-center backdrop-blur shadow-xl animate-fade-in z-50 pointer-events-none">
                <span className="font-bold text-purple-300">军师:</span> {aiHint}
             </div>
          )}

          {/* My Player Area */}
          <PlayerArea 
             player={pMe} 
             gameState={gameState} 
             position="bottom" 
             selectedCardIds={selectedCardIds}
             onCardClick={toggleCardSelection}
          />
        </div>
      </div>
    </div>
  );
};
