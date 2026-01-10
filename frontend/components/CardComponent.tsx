import React, { useState } from 'react';
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
  const imgSrc = `/cards/${svgName}`;

  return (
    <div
      onClick={onClick}
      className={`
        relative select-none
        flex flex-col items-center justify-center
        cursor-pointer shrink-0
        transition-transform duration-200
        
        /* If image fails, apply card styling. If image works, assume SVG has its own border/style or apply basics */
        ${imgError 
            ? 'bg-white rounded-lg shadow-md border border-gray-200' 
            : 'drop-shadow-lg'
        }

        /* Selection Effects */
        ${selected 
            ? '-translate-y-4 sm:-translate-y-6 z-20' 
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
          src={imgSrc} 
          alt={svgName}
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        /* Fallback CSS Rendering */
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
      
      {/* Selected Indicator Badge */}
      {selected && (
          <div className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm z-30 ring-2 ring-white">
              ✓
          </div>
      )}
    </div>
  );
};
