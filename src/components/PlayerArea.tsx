
import React from 'react';
import { Player, PlayerRole, GamePhase, GameState } from '../types';
import { CardComponent } from './CardComponent';

interface PlayerAreaProps {
  player: Player;
  gameState: GameState;
  position: 'top' | 'left' | 'right' | 'bottom';
  selectedCardIds?: string[];
  onCardClick?: (cardId: string) => void;
}

export const PlayerArea: React.FC<PlayerAreaProps> = ({ 
  player, 
  gameState, 
  position, 
  selectedCardIds = [], 
  onCardClick 
}) => {
  const isCurrentTurn = gameState.currentTurnIndex === player.id;
  const isWinner = gameState.winnerId === player.id;
  
  // Dynamic Hand Layout Logic
  const handLength = player.hand.length;
  // Scale down if hand is large (only relevant for bottom player mostly)
  const handScale = position === 'bottom' && handLength > 17 ? 0.85 : (handLength > 14 ? 0.92 : 1);
  
  // Dynamic margin calculation to overlap cards nicely
  const getDynamicMargin = () => {
      if (position === 'bottom') {
          if (handLength > 15) return -45;
          if (handLength > 10) return -35;
          return -30;
      }
      return position === 'top' ? -30 : -40; 
  };
  
  const dynamicMargin = getDynamicMargin();

  // Helper to render last played cards floating near player
  const renderLastMove = () => {
    if (gameState.lastMove && gameState.lastMove.playerId === player.id && gameState.phase !== GamePhase.GameOver) {
      return (
        <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
           <div className="bg-black/60 p-1 md:p-2 rounded-xl flex gap-1 animate-fade-in-up shadow-lg">
              {gameState.lastMove.cards.length > 0 ? (
                gameState.lastMove.cards.map((c) => <CardComponent key={c.id} card={c} small />)
              ) : (
                <span className="text-white font-bold px-2 md:px-4 py-1 md:py-2 text-sm md:text-base">不出</span>
              )}
           </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`flex flex-col items-center ${position === 'left' || position === 'right' ? 'w-24 md:w-32' : 'w-full'} transition-opacity duration-300 ${isCurrentTurn ? 'opacity-100 scale-105' : 'opacity-80'} relative`}>
      
      {/* Avatar / Info */}
      <div className={`
          relative flex flex-col items-center mb-2 p-1 md:p-2 rounded-lg transition-colors
          ${isCurrentTurn ? 'bg-yellow-500/20 border-2 border-yellow-400' : 'bg-black/30'}
          ${isWinner ? 'bg-yellow-500 animate-bounce text-black' : ''}
      `}>
        <div className="font-bold text-xs md:text-base whitespace-nowrap max-w-[80px] md:max-w-[120px] overflow-hidden text-ellipsis text-center">
            {player.name}
        </div>
        <div className="text-[10px] md:text-xs flex items-center gap-1">
          {player.role === PlayerRole.Landlord ? '👑' : player.role === PlayerRole.Peasant ? '👨‍🌾' : '👤'} 
          <span className="font-mono bg-black/40 px-1 rounded ml-1 text-white">{player.hand.length}</span>
        </div>
        
        {/* Thinking Indicator */}
        {gameState.phase === GamePhase.Playing && isCurrentTurn && !isWinner && (
           <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap shadow-sm">
             思考中
           </div>
        )}
      </div>

      {/* Hand Area */}
      <div className="flex justify-center items-end h-24 md:h-36 perspective-1000 w-full">
        {player.isHuman ? (
           <div 
             className="flex items-end transition-transform duration-300 origin-bottom pl-4 pr-4"
             style={position === 'bottom' ? { transform: `scale(${handScale})` } : {}}
           >
             {player.hand.map((card, idx) => (
               <div 
                 key={card.id} 
                 className="transition-all duration-100 origin-bottom hover:z-20" 
                 style={{ 
                     marginLeft: idx === 0 ? 0 : `${dynamicMargin}px`, 
                     zIndex: idx 
                 }}
               >
                 <CardComponent 
                   card={card} 
                   selected={selectedCardIds.includes(card.id)} 
                   onClick={() => onCardClick && onCardClick(card.id)} 
                   small={window.innerWidth < 768 && position !== 'bottom'} 
                 />
               </div>
             ))}
           </div>
        ) : (
          // Opponent (Bot/Remote) Hand - usually hidden
          <div className="flex pl-6 md:pl-8">
             {player.hand.map((card, idx) => (
               <div key={card.id} className={`${idx > 0 ? '-ml-6 md:-ml-8' : ''}`} style={{ zIndex: idx }}>
                  <CardComponent card={card} hidden small />
               </div>
             ))}
          </div>
        )}
      </div>
      
      {/* Last Played Cards Overlay */}
      {renderLastMove()}
      
    </div>
  );
};
