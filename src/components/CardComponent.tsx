import React from 'react';
import { Card, Rank, Suit } from '../types';

interface CardProps {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
  hidden?: boolean;
}

// 映射函数：将卡牌对象转换为对应的文件名
const getCardImageFilename = (rank: Rank, suit: Suit): string => {
  // 大小王处理
  if (rank === Rank.RedJoker) return "red_joker.svg";
  if (rank === Rank.BlackJoker) return "black_joker.svg";

  // 点数映射
  let rankStr = "";
  switch (rank) {
    case Rank.Ace: rankStr = "ace"; break;
    case Rank.Two: rankStr = "2"; break;
    case Rank.Jack: rankStr = "jack"; break;
    case Rank.Queen: rankStr = "queen"; break;
    case Rank.King: rankStr = "king"; break;
    default: 
      // 3, 4, ..., 10 直接转字符串
      rankStr = rank.toString(); 
      break;
  }

  // 花色映射
  let suitStr = "";
  switch (suit) {
    case Suit.Hearts: suitStr = "hearts"; break;
    case Suit.Diamonds: suitStr = "diamonds"; break;
    case Suit.Clubs: suitStr = "clubs"; break;
    case Suit.Spades: suitStr = "spades"; break;
    default: suitStr = ""; break;
  }

  // 拼接文件名
  return `${rankStr}_of_${suitStr}.svg`;
};

export const CardComponent: React.FC<CardProps> = ({ card, onClick, selected, small, hidden }) => {
  // 卡牌背面样式
  if (hidden) {
    return (
      <div 
        className={`
          ${small ? 'w-10 h-14' : 'w-20 h-28 md:w-24 md:h-36'} 
          bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-white rounded-lg shadow-md flex items-center justify-center
          relative overflow-hidden
        `}
      >
        {/* 简单的背面花纹模拟 */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_#ffffff_1px,_transparent_1px)] [background-size:8px_8px]"></div>
        <div className="w-8 h-8 md:w-12 md:h-12 border-2 border-blue-300 rounded-full flex items-center justify-center">
            <span className="text-blue-300 text-xs md:text-sm">Gemini</span>
        </div>
      </div>
    );
  }

  const imageName = getCardImageFilename(card.rank, card.suit);
  const imagePath = `/cards/${imageName}`;

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg shadow-md select-none transition-transform duration-200 cursor-pointer bg-white
        ${small ? 'w-10 h-14' : 'w-20 h-28 md:w-24 md:h-36'}
        ${selected ? '-translate-y-4 md:-translate-y-6 ring-4 ring-yellow-400 z-10' : 'hover:-translate-y-2'}
      `}
    >
      <img 
        src={imagePath} 
        alt={card.label} 
        className="w-full h-full object-contain rounded-lg"
        draggable={false}
        onError={(e) => {
          // 如果图片加载失败（比如还没上传），回退到简单的文字显示
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.classList.add('flex', 'flex-col', 'items-center', 'justify-between', 'p-1');
          // 这里可以添加逻辑显示备用文字，但利用React状态会更复杂，
          // 这里简单处理：如果图片挂了，父容器会变为空白，
          // 建议确保 public/cards/ 下有正确的图片。
        }}
      />
      
      {/* 备用文字层：仅当图片未加载或为了辅助阅读时可启用，目前完全依赖图片 */}
      {/* 如果需要图片加载失败时的文字回退，可以在这里加一个 absolute 层，默认 hidden，onError 时显示 */}
    </div>
  );
};