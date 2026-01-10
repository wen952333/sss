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
      console.error(`[CardComponent] Failed to load image: ${imgSrc}. Please ensure the file exists in 'frontend/public/cards/'.`);
      setImgError(true);
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative select-none
        flex flex-col items-center justify-center
        cursor-pointer shrink-0
        transition-transform duration-200
        overflow-hidden
        
        ${imgError 
            ? 'bg-white rounded-lg shadow-md border border-gray-300' 
            : 'drop-shadow-md rounded-lg' /* Allow SVG to define shape/border if transparent */
        }

        ${selected 
            ? '-translate-y-4 sm:-translate-y-6 z-20 ring-2 ring-yellow-400' 
            : 'hover:-translate-y-2'
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
          className="w-full h-full object-contain"
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
      
      {/* Selected Indicator Badge */}
      {selected && (
          <div className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-sm z-30 ring-2 ring-white">
              ✓
          </div>
      )}
    </div>
  );
};