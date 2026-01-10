import React from 'react';
import { Card } from '../types';
import { getRankSymbol, getSuitSymbol, getSuitColor } from '../services/deck';

interface CardProps {
  card: Card;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  small?: boolean;
  className?: string;
}

export const CardComponent: React.FC<CardProps> = ({ card, selected, onClick, small, className = '' }) => {
  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-lg shadow-md border border-gray-200 select-none
        flex flex-col items-center justify-center
        cursor-pointer shrink-0
        ${selected 
            ? 'ring-4 ring-red-500 shadow-xl z-10' 
            : ''
        }
        ${small 
            ? 'w-10 h-14 text-xs' 
            : 'w-24 h-36 sm:w-32 sm:h-48 text-3xl sm:text-6xl'
        }
        ${className}
      `}
    >
      <div className={`absolute top-1 left-1 font-bold text-sm sm:text-lg ${getSuitColor(card.suit)}`}>
        {getRankSymbol(card.rank)}
      </div>
      <div className={`text-5xl sm:text-7xl ${getSuitColor(card.suit)}`}>
        {getSuitSymbol(card.suit)}
      </div>
      <div className={`absolute bottom-1 right-1 font-bold text-sm sm:text-lg ${getSuitColor(card.suit)} rotate-180`}>
         {getRankSymbol(card.rank)}
      </div>
      
      {selected && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow-sm z-20">
              ✓
          </div>
      )}
    </div>
  );
};