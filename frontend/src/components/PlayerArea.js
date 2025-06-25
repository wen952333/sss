import React from 'react';
import Card from './Card';
import '../styles/PlayerArea.css';

const PlayerArea = ({ player, isCurrent }) => {
  return (
    <div className={`player-area ${isCurrent ? 'current' : ''}`}>
      <div className="player-info">
        <h4>{player.nickname}</h4>
        <p>积分: {player.points}</p>
        {isCurrent && <span className="current-label">(你)</span>}
      </div>
      
      <div className="player-cards">
        {player.cards && player.cards.slice(0, 5).map((card, index) => (
          <Card 
            key={index} 
            card={card} 
            size="small" 
          />
        ))}
        {player.cards && player.cards.length > 5 && (
          <div className="more-cards">+{player.cards.length - 5}张</div>
        )}
      </div>
    </div>
  );
};

export default PlayerArea;
