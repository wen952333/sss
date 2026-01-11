
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
  // Ensure we look for cards in the root /cards/ directory
  const imgSrc = `/cards/${svgName}`;

  // Reset error state if card changes
  useEffect(() => {
    setImgError(false);
  }, [card.id]);

  const handleError = () => {
      setImgError(true);
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-lg shadow-md select-none
        flex flex-col items-center justify-center
        cursor-pointer shrink-0
        outline-none
        overflow-hidden
        
        ${selected 
            ? 'ring-2 ring-yellow-400 bg-yellow-50 brightness-105' 
            : ''
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
        <>
          <div className={`absolute top-1 left-1 font-bold text-sm sm:text-lg ${getSuitColor(card.suit)}`}>
            {getRankSymbol(card.rank)}
          </div>
          <div className={`text-5xl sm:text-7xl ${getSuitColor(card.suit)}`}>
            {getSuitSymbol(card.suit)}
          </div>
          <div className={`absolute bottom-1 right-1 font-bold text-sm sm:text-lg ${getSuitColor(card.suit)} rotate-180`}>
             {getRankSymbol(card.rank)}
          </div>
        </>
      )}
      
      {/* Selected Indicator Badge - BOTTOM LEFT */}
      {selected && (
          <div className="absolute bottom-1 left-1 bg-yellow-500 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black shadow-sm z-30 leading-none">
              ✓
          </div>
      )}
    </div>
  );
};
