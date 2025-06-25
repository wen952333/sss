import React, { useState } from 'react';
import Card from './Card';

const GameTable = ({ gameData, players, userId }) => {
  const [selectedCards, setSelectedCards] = useState([]);
  const [currentAction, setCurrentAction] = useState('select'); // select, arrange, submit
  const [arrangedCards, setArrangedCards] = useState({ front: [], middle: [], back: [] });
  
  const currentPlayer = players.find(p => p.id === userId);
  
  // 选择/取消选择卡牌
  const handleCardSelect = (card) => {
    if (currentAction !== 'select') return;
    
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      if (selectedCards.length < 13) {
        setSelectedCards([...selectedCards, card]);
      }
    }
  };
  
  // 排列卡牌到指定区域
  const arrangeCards = (area) => {
    if (selectedCards.length === 0) return;
    
    const maxCards = {
      front: 3,
      middle: 5,
      back: 5
    }[area];
    
    if (arrangedCards[area].length + selectedCards.length > maxCards) {
      alert(`该区域最多只能放置${maxCards}张牌`);
      return;
    }
    
    setArrangedCards({
      ...arrangedCards,
      [area]: [...arrangedCards[area], ...selectedCards]
    });
    
    // 从玩家手牌中移除已排列的卡牌
    const newHand = currentPlayer.hand.filter(
      card => !selectedCards.includes(card)
    );
    
    // 更新玩家状态
    const updatedPlayers = players.map(player => 
      player.id === userId ? { ...player, hand: newHand } : player
    );
    
    setSelectedCards([]);
  };
  
  // 提交牌型
  const submitCards = async () => {
    if (arrangedCards.front.length !== 3 || 
        arrangedCards.middle.length !== 5 || 
        arrangedCards.back.length !== 5) {
      alert('请正确排列所有牌型');
      return;
    }
    
    try {
      const response = await fetch('https://9526.ip-ddns.com/api/game.php?action=submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: gameData.id,
          userId,
          front: arrangedCards.front,
          middle: arrangedCards.middle,
          back: arrangedCards.back
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentAction('waiting');
      }
    } catch (error) {
      console.error('提交牌型失败:', error);
    }
  };
  
  return (
    <div className="game-table">
      <div className="table-center">
        <div className="pot-area">
          {gameData.pot > 0 && <div className="pot">底池: {gameData.pot}</div>}
        </div>
      </div>
      
      <div className="opponents-area">
        {players.filter(p => p.id !== userId).map(player => (
          <div key={player.id} className="player-seat">
            <div className="player-info">
              <div>{player.name}</div>
              <div>筹码: {player.chips}</div>
            </div>
            <div className="player-status">
              {player.ready ? '已准备' : '思考中...'}
            </div>
          </div>
        ))}
      </div>
      
      <div className="player-area">
        <div className="player-hand">
          <h3>你的手牌</h3>
          <div className="cards-container">
            {currentPlayer.hand.map((card, index) => (
              <Card
                key={`${card.rank}${card.suit}${index}`}
                card={card}
                onClick={() => handleCardSelect(card)}
                selected={selectedCards.includes(card)}
                size="medium"
              />
            ))}
          </div>
        </div>
        
        {currentAction === 'select' && (
          <div className="action-buttons">
            <button 
              onClick={() => setCurrentAction('arrange')}
              disabled={selectedCards.length !== 13}
            >
              排列牌型 ({selectedCards.length}/13)
            </button>
          </div>
        )}
        
        {currentAction === 'arrange' && (
          <div className="arrange-area">
            <div className="arrange-section">
              <h4>前墩 (3张)</h4>
              <div className="cards-container">
                {arrangedCards.front.map((card, index) => (
                  <Card 
                    key={`front-${index}`} 
                    card={card} 
                    size="small" 
                  />
                ))}
              </div>
              <button onClick={() => arrangeCards('front')}>放置到前墩</button>
            </div>
            
            <div className="arrange-section">
              <h4>中墩 (5张)</h4>
              <div className="cards-container">
                {arrangedCards.middle.map((card, index) => (
                  <Card 
                    key={`middle-${index}`} 
                    card={card} 
                    size="small" 
                  />
                ))}
              </div>
              <button onClick={() => arrangeCards('middle')}>放置到中墩</button>
            </div>
            
            <div className="arrange-section">
              <h4>后墩 (5张)</h4>
              <div className="cards-container">
                {arrangedCards.back.map((card, index) => (
                  <Card 
                    key={`back-${index}`} 
                    card={card} 
                    size="small" 
                  />
                ))}
              </div>
              <button onClick={() => arrangeCards('back')}>放置到后墩</button>
            </div>
            
            <div className="action-buttons">
              <button onClick={() => setCurrentAction('select')}>返回选择</button>
              <button onClick={submitCards}>提交牌型</button>
            </div>
          </div>
        )}
        
        {currentAction === 'waiting' && (
          <div className="waiting-message">
            已提交牌型，等待其他玩家...
          </div>
        )}
      </div>
    </div>
  );
};

export default GameTable;
