import React from 'react';
import { Card } from '../types';
import { CardComponent } from './CardComponent';

interface HandRowProps {
  title: string;
  cards: Card[];
  maxCards: number;
  onCardClick?: (card: Card) => void;
  onRowClick?: () => void;
  selectedCardIds?: string[];
  className?: string;
  placeholder?: string;
}

export const HandRow: React.FC<HandRowProps> = ({ 
    title, cards, maxCards, onCardClick, onRowClick, selectedCardIds = [], className, placeholder 
}) => {
  const hasSelection = selectedCardIds.length > 0;
  return (
    <div className={`relative ${className}`}>
      <div className={`relative w-full min-h-[11rem] sm:min-h-[14rem] rounded-xl shadow-inner border transition-colors overflow-hidden ${hasSelection ? 'bg-yellow-500/20 border-yellow-400/50 hover:bg-yellow-500/30' : 'bg-white/10 border-white/5'}`}>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end pointer-events-none select-none z-0">
             <span className="text-white/20 font-black text-3xl sm:text-5xl tracking-widest uppercase">{title}</span>
             <span className={`text-base sm:text-lg font-mono mt-1 ${cards.length !== maxCards ? 'text-yellow-400 font-bold' : 'text-white/30'}`}>{cards.length} / {maxCards}</span>
        </div>
        <div onClick={onRowClick} className="absolute inset-0 flex items-center overflow-x-auto scrollbar-hide pl-2 sm:pl-4 z-10 cursor-pointer">
            {cards.length === 0 && (
                <div className="w-full text-center text-white/30 italic text-sm pointer-events-none select-none pr-12">
                    {placeholder || (hasSelection ? "点击此处移动牌" : "点击理牌按钮获取推荐")}
                </div>
            )}
            {cards.map((card, index) => (
              <CardComponent key={card.id} card={card} selected={selectedCardIds.includes(card.id)} className={`${index > 0 ? '-ml-16 sm:-ml-20' : ''} transition-all shadow-md`} onClick={(e) => { e.stopPropagation(); onCardClick && onCardClick(card); }} />
            ))}
            <div className="min-w-[4rem] h-1 shrink-0"></div>
        </div>
      </div>
    </div>
  );
};