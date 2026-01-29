
import React from 'react';
import { CardType, HandSegment, PlayerHand } from '../types';
import { Card } from './Card';
import { Check, Sparkles, Loader2 } from 'lucide-react';

interface ArrangementBoardProps {
  arrangedHand: PlayerHand;
  selectedCards: CardType[];
  onCardClick: (card: CardType) => void;
  onRowClick: (segment: HandSegment) => void;
  onSubmit: () => void;
  onSmartArrange: () => void;
  isAiLoading: boolean;
}

export const ArrangementBoard: React.FC<ArrangementBoardProps> = ({
  arrangedHand,
  selectedCards,
  onCardClick,
  onRowClick,
  onSubmit,
  onSmartArrange,
  isAiLoading
}) => {
  const renderRow = (segment: HandSegment, label: string) => {
    const cards = arrangedHand[segment];
    const targetCount = segment === HandSegment.Front ? 3 : 5;
    const isCountCorrect = cards.length === targetCount;
    
    return (
      <div 
        onClick={() => onRowClick(segment)}
        className="flex-1 relative flex items-center px-4 sm:px-8 bg-white/5 rounded-2xl border border-white/10 mb-3 group transition-all hover:bg-white/10 hover:border-white/20 min-h-[140px] sm:min-h-[200px] cursor-pointer"
      >
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end pointer-events-none z-0">
            <div className="text-3xl sm:text-5xl font-black tracking-widest text-white/5 group-hover:text-white/10 transition-colors uppercase">
                {segment === HandSegment.Front ? 'Front' : segment === HandSegment.Middle ? 'Middle' : 'Back'}
            </div>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-lg sm:text-2xl font-bold text-gray-500">{label}</span>
                <span className={`text-sm sm:text-base font-mono px-2 py-0.5 rounded-full transition-colors ${isCountCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {cards.length}/{targetCount}
                </span>
            </div>
        </div>

        <div className="relative z-10 flex items-center h-full w-full pl-2 pointer-events-none">
            {cards.map((card, index) => {
                const isSelected = selectedCards.some(c => c.id === card.id);
                return (
                    <div 
                        key={card.id} 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            onCardClick(card);
                        }} 
                        className="pointer-events-auto transition-all duration-200"
                        style={{ 
                            marginLeft: index === 0 ? 0 : '-50px', 
                            zIndex: index, 
                        }}
                    >
                        <Card card={card} selected={isSelected} />
                    </div>
                );
            })}
            
            {cards.length === 0 && (
                <div className="absolute left-6 text-white/20 text-lg sm:text-xl font-medium italic border-2 border-dashed border-white/10 rounded-xl w-24 h-36 sm:w-32 sm:h-48 flex items-center justify-center pointer-events-none">
                    点击移入
                </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-full max-w-6xl mx-auto pb-4">
      <div className="flex-none flex items-center justify-between mb-4 px-2">
        <div className="flex flex-col">
           <h2 className="text-xl font-bold text-white tracking-tight">理牌阶段</h2>
           <p className="text-gray-400 text-xs">勾选扑克牌，点击牌墩移动</p>
        </div>
        
        <div className="flex items-center gap-3">
            <button
                onClick={onSmartArrange}
                disabled={isAiLoading}
                className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-all shadow-lg shadow-teal-900/50 text-base font-bold active:scale-95 border border-teal-500/30"
            >
                {isAiLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : (
                    <Sparkles size={20} />
                )}
                <span>{isAiLoading ? '计算中...' : '智能理牌'}</span>
            </button>

            <button 
                onClick={onSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl transition-all shadow-lg shadow-yellow-900/50 text-base font-bold active:scale-95"
            >
                <Check size={20} /> 确认出牌
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 sm:gap-4 min-h-0">
        {renderRow(HandSegment.Front, '头墩')}
        {renderRow(HandSegment.Middle, '中墩')}
        {renderRow(HandSegment.Back, '尾墩')}
      </div>
    </div>
  );
};
