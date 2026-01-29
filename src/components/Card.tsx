
import React from 'react';
import { CardType } from '../types';
import { Check } from 'lucide-react';
import { getCardAssetPath } from '../utils/pokerLogic';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, selected, onClick, small }) => {
  const imageSrc = getCardAssetPath(card);

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-transparent select-none cursor-pointer
        transition-all duration-100 transform
        ${small ? 'w-8 h-12' : 'w-24 h-36 sm:w-32 sm:h-48'}
        ${selected ? '-translate-y-4' : 'hover:-translate-y-1'}
      `}
    >
      {/* SVG Image - Fixed white border issue by using object-cover and removing bg-white */}
      <img 
        src={imageSrc} 
        alt={`${card.rank} of ${card.suit}`}
        className={`
          w-full h-full object-cover rounded-lg shadow-xl
          ${selected ? 'ring-4 ring-yellow-400' : 'ring-1 ring-black/20'}
        `}
        draggable={false}
      />

      {/* Selection Checkmark (Overlay) */}
      {selected && !small && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-lg z-20 animate-in zoom-in duration-200 border-2 border-white">
              <Check size={16} strokeWidth={4} />
          </div>
      )}
    </div>
  );
};
