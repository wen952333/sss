import React from 'react';

const Card = ({ card, onClick, selected, size = 'medium' }) => {
  if (!card) return null;
  
  const getCardImage = () => {
    const suitMap = {
      'S': 'spades',
      'H': 'hearts',
      'D': 'diamonds',
      'C': 'clubs'
    };
    
    const rankMap = {
      '1': 'ace',
      '11': 'jack',
      '12': 'queen',
      '13': 'king'
    };
    
    let rank = card.rank;
    if (rankMap[rank]) {
      rank = rankMap[rank];
    }
    
    const suit = suitMap[card.suit];
    
    return `${rank}_of_${suit}.svg`;
  };
  
  const sizeClass = {
    small: 'card-small',
    medium: 'card-medium',
    large: 'card-large'
  }[size];
  
  return (
    <div 
      className={`card ${sizeClass} ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <img 
        src={`/images/cards/${getCardImage()}`} 
        alt={`${card.rank}${card.suit}`} 
      />
      <div className="card-corner">
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit">{card.suit}</div>
      </div>
    </div>
  );
};

export default Card;
