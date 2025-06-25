import React from 'react';
import '../styles/GameControls.css';

const GameControls = ({ onPlayCards, onLeaveRoom, isOwner, onStartGame }) => {
  return (
    <div className="game-controls">
      <button className="btn leave-btn" onClick={onLeaveRoom}>
        离开房间
      </button>
      
      {isOwner && (
        <button className="btn start-btn" onClick={onStartGame}>
          开始游戏
        </button>
      )}
      
      <button className="btn play-btn" onClick={onPlayCards}>
        出牌
      </button>
    </div>
  );
};

export default GameControls;
