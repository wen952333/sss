import React from 'react';

const Card = ({ card, size = 'medium' }) => {
  if (!card) return null;
  
  const getCardImage = () => {
    let rank = card.rank.toLowerCase();
    if (rank === '1' || rank === 'a') rank = 'ace';
    if (rank === 'k') rank = 'king';
    if (rank === 'q') rank = 'queen';
    if (rank === 'j') rank = 'jack';
    
    const suit = card.suit.toLowerCase();
    return `${rank}_of_${suit}.svg`;
  };
  
  const sizeClass = {
    small: 'card-small',
    medium: 'card-medium',
    large: 'card-large'
  }[size];
  
  return (
    <div className={`card ${sizeClass}`}>
      <img 
        src={`/assets/cards/${getCardImage()}`} 
        alt={`${card.rank} of ${card.suit}`}
        onError={(e) => {
          e.target.src = '/assets/cards/card_back.svg';
        }}
      />
    </div>
  );
};

export default Card;
