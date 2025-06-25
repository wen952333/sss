import React from 'react';
import Card from './Card';
import '../styles/CardArea.css';

const CardArea = ({ cards, selectedCards, onCardSelect }) => {
  return (
    <div className="card-area">
      {cards.map((card, index) => (
        <div 
          key={index} 
          className={`card-wrapper ${selectedCards.includes(index) ? 'selected' : ''}`}
          onClick={() => onCardSelect(index)}
        >
          <Card card={card} size="medium" />
        </div>
      ))}
    </div>
  );
};

export default CardArea;
