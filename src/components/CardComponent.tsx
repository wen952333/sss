
import React, { useState, useEffect } from 'react';
import { Card } from '../types';
import { getRankSymbol, getSuitSymbol, getSuitColor, getCardSvgName } from '../services/deck';

interface CardProps {
  card: Card;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  small?: boolean;
  className?: string;
}

export const CardComponent: React.FC<CardProps> = ({ card, selected, onClick, small, className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const svgName = getCardSvgName(card);
  // Ensure we look for cards in the root /cards/ directory (mapped to frontend/public/cards)
  const imgSrc = `/cards/${svgName}`;

  // Reset error state if card changes (though usually component is remounted)
  useEffect(() => {
    setImgError(false);
  }, [card.id]);

  const handleError = () => {
      // Prevent infinite loop if fallback fails, but we use CSS fallback anyway
      setImgError(true);
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative select-none
        flex flex-col items-center justify-center
        cursor-pointer shrink-0
        transition-all duration-150 ease-out
        overflow-hidden
        
        ${imgError 
            ? 'bg-white rounded-lg shadow-md border border-gray-300' 
            : 'drop-shadow-md rounded-lg' /* Allow SVG to define shape/border if transparent */
        }

        /* 
           SELECTION LOGIC UPDATE:
           - Removed -translate-y (no pop up)
           - Removed z-20 (keep natural stack order, so visible right edge implies overlapped by next card)
           - Added ring-4 yellow (high visibility border)
           - Added brightness boost
        */
        ${selected 
            ? 'ring-4 ring-yellow-400 ring-inset brightness-110 bg-yellow-50' 
            : 'hover:-translate-y-1 brightness-100'
        }
        
        ${small 
            ? 'w-10 h-14 text-xs' 
            : 'w-24 h-36 sm:w-32 sm:h-48 text-3xl sm:text-6xl'
        }
        ${className}
      `}
    >
      {!imgError ? (
        <img 
          key={imgSrc} // Force reload if src changes
          src={imgSrc} 
          alt={svgName}
          className="w-full h-full object-contain pointer-events-none"
          onError={handleError}
          draggable={false}
        />
      ) : (
        /* Fallback CSS Rendering if Image Fails */
        <div className="w-full h-full flex flex-col justify-between p-1 sm:p-2 bg-white">
          <div className={`font-bold leading-none text-left ${getSuitColor(card.suit)} text-sm sm:text-xl`}>
            {getRankSymbol(card.rank)}
          </div>
          <div className={`flex-1 flex items-center justify-center text-4xl sm:text-6xl ${getSuitColor(card.suit)}`}>
            {getSuitSymbol(card.suit)}
          </div>
          <div className={`font-bold leading-none text-right ${getSuitColor(card.suit)} rotate-180 text-sm sm:text-xl`}>
             {getRankSymbol(card.rank)}
          </div>
        </div>
      )}
      
      {/* Selected Indicator Badge - Moved to TOP LEFT because in a fan, the right side is covered */}
      {selected && (
          <div className="absolute top-1 left-1 bg-yellow-500 text-black rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md z-30 border border-white/50">
              ✓
          </div>
      )}
    </div>
  );
};
