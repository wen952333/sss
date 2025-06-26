// frontend/src/components/PlayerHand.jsx
import React, { useState, useEffect } from 'react';
import Card from './Card.jsx';             // <--- 修改导入后缀
import HandDisplay from './HandDisplay.jsx'; // <--- 修改导入后缀
import { submitHandApi, getHandTypeName } from '../utils/api'; // Added getHandTypeName from previous logic

const PlayerHand = ({ gameId, player, initialCards, onHandSubmitted, isMyTurnToArrange, isLoading }) => {
  const [unassignedCards, setUnassignedCards] = useState([]);
  const [frontHand, setFrontHand] = useState([]);
  const [middleHand, setMiddleHand] = useState([]);
  const [backHand, setBackHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setUnassignedCards(initialCards || []);
    setFrontHand([]);
    setMiddleHand([]);
    setBackHand([]);
    setSelectedCard(null);
    setError('');
  }, [initialCards]);

  const handleCardClick = (cardString) => {
    if (selectedCard === cardString) {
      setSelectedCard(null);
    } else {
      if (unassignedCards.includes(cardString)) {
         setSelectedCard(cardString);
      } else {
        if (frontHand.includes(cardString)) {
            setFrontHand(prev => prev.filter(c => c !== cardString));
            setUnassignedCards(prev => [...prev, cardString].sort()); // sort for consistent order
            setSelectedCard(null);
        } else if (middleHand.includes(cardString)) {
            setMiddleHand(prev => prev.filter(c => c !== cardString));
            setUnassignedCards(prev => [...prev, cardString].sort());
            setSelectedCard(null);
        } else if (backHand.includes(cardString)) {
            setBackHand(prev => prev.filter(c => c !== cardString));
            setUnassignedCards(prev => [...prev, cardString].sort());
            setSelectedCard(null);
        }
      }
    }
  };

  const handleHandAreaClick = (areaName) => {
    if (!selectedCard) return;

    if (areaName === 'front' && frontHand.length < 3) {
      setFrontHand(prev => [...prev, selectedCard]);
      setUnassignedCards(prev => prev.filter(c => c !== selectedCard));
      setSelectedCard(null);
    } else if (areaName === 'middle' && middleHand.length < 5) {
      setMiddleHand(prev => [...prev, selectedCard]);
      setUnassignedCards(prev => prev.filter(c => c !== selectedCard));
      setSelectedCard(null);
    } else if (areaName === 'back' && backHand.length < 5) {
      setBackHand(prev => [...prev, selectedCard]);
      setUnassignedCards(prev => prev.filter(c => c !== selectedCard));
      setSelectedCard(null);
    } else {
        setError(`该墩已满或无效操作。`);
        setTimeout(() => setError(''), 2000);
    }
  };
  
  const handleSubmit = async () => {
    if (frontHand.length !== 3 || middleHand.length !== 5 || backHand.length !== 5) {
      setError('墩牌张数不正确！前墩3张，中墩5张，后墩5张。');
      return;
    }
    setError('');
    const arrangedData = {
      front: frontHand,
      middle: middleHand,
      back: backHand,
    };
    try {
      const result = await submitHandApi(gameId, arrangedData);
      if (result.success) {
        onHandSubmitted(result.gameState);
      } else {
        setError(result.message || '提交失败');
      }
    } catch (err) {
      setError('提交时发生错误: ' + err.message);
    }
  };

  if (!isMyTurnToArrange || !player || player.hasSubmitted) {
    return (
        <div className="player-hand-submitted">
            <h4>{player?.name || '玩家'} {player?.hasSubmitted ? "已提交牌型" : "等待理牌"}</h4>
            {player?.arrangedHands && (
                <>
                    <HandDisplay label="前墩" cards={player.arrangedHands.front} evaluation={player.evaluatedHands?.front} />
                    <HandDisplay label="中墩" cards={player.arrangedHands.middle} evaluation={player.evaluatedHands?.middle} />
                    <HandDisplay label="后墩" cards={player.arrangedHands.back} evaluation={player.evaluatedHands?.back} />
                    {player.evaluatedHands?.isMisarranged && <p className="error-message">{getHandTypeName("MISARRANGED", player.evaluatedHands)}</p>}
                    {player.evaluatedHands?.specialType && <p className="info-message">特殊牌型: {getHandTypeName(player.evaluatedHands.specialType, player.evaluatedHands)}</p>}
                </>
            )}
        </div>
    );
  }

  return (
    <div className="player-hand-arranger">
      <h3>轮到你了, {player.name} - 请理牌</h3>
      {error && <p className="error-message">{error}</p>}
      
      <h4>你的手牌 (未分配: {unassignedCards.length}张):</h4>
      <div className="player-cards-container">
        {unassignedCards.sort().map(cardStr => (
          <Card 
            key={cardStr} 
            cardString={cardStr} 
            onClick={() => handleCardClick(cardStr)}
            isSelected={selectedCard === cardStr}
          />
        ))}
      </div>

      <HandDisplay label="前墩 (3张)" cards={frontHand} onClick={() => handleHandAreaClick('front')} />
      <HandDisplay label="中墩 (5张)" cards={middleHand} onClick={() => handleHandAreaClick('middle')} />
      <HandDisplay label="后墩 (5张)" cards={backHand} onClick={() => handleHandAreaClick('back')} />
      
      <button onClick={handleSubmit} disabled={isLoading || frontHand.length !== 3 || middleHand.length !== 5 || backHand.length !== 5}>
        {isLoading ? '提交中...' : '确认提交牌型'}
      </button>
    </div>
  );
};

export default PlayerHand;
