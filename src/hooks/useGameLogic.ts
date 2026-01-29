
import { useState } from 'react';
import { GameState, HandSegment, PlayerHand, CardType } from '../types';
import { dealCards } from '../utils/pokerLogic';

const initialHandState: PlayerHand = {
  [HandSegment.Front]: [],
  [HandSegment.Middle]: [],
  [HandSegment.Back]: []
};

export const useGameLogic = () => {
  const [gameState, setGameState] = useState<GameState['phase']>('lobby');
  const [arrangedHand, setArrangedHand] = useState<PlayerHand>(initialHandState);
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [currentTable, setCurrentTable] = useState<number | null>(null);
  const [currentSeat, setCurrentSeat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startGame = () => {
    const dealtHands = dealCards();
    const myHand = dealtHands[0];
    
    setArrangedHand({
        [HandSegment.Front]: myHand.slice(0, 3),
        [HandSegment.Middle]: myHand.slice(3, 8),
        [HandSegment.Back]: myHand.slice(8, 13)
    });
    
    setSelectedCards([]);
    setShowResult(false);
    setErrorMsg(null);
    setGameState('arranging');
  };

  const handleJoinGame = (tableId: number, seatId: string) => {
    setCurrentTable(tableId);
    setCurrentSeat(seatId);
    startGame();
  };

  const exitGame = () => {
    setGameState('lobby');
    setCurrentTable(null);
    setCurrentSeat(null);
    setArrangedHand(initialHandState);
    setErrorMsg(null);
  };

  const handleCardInteraction = (card: CardType) => {
    const isSelected = selectedCards.find(c => c.id === card.id);
    if (isSelected) {
      setSelectedCards(prev => prev.filter(c => c.id !== card.id));
    } else {
      setSelectedCards(prev => [...prev, card]);
    }
  };

  const handleRowClick = (targetSegment: HandSegment) => {
    if (selectedCards.length === 0) return;

    setArrangedHand(prev => {
        const newHand = { ...prev };
        const selectedIds = new Set(selectedCards.map(c => c.id));
        newHand[HandSegment.Front] = newHand[HandSegment.Front].filter(c => !selectedIds.has(c.id));
        newHand[HandSegment.Middle] = newHand[HandSegment.Middle].filter(c => !selectedIds.has(c.id));
        newHand[HandSegment.Back] = newHand[HandSegment.Back].filter(c => !selectedIds.has(c.id));
        newHand[targetSegment] = [...newHand[targetSegment], ...selectedCards];
        return newHand;
    });

    setSelectedCards([]);
    setErrorMsg(null);
  };

  const handleSubmit = () => {
      const frontCount = arrangedHand[HandSegment.Front].length;
      const middleCount = arrangedHand[HandSegment.Middle].length;
      const backCount = arrangedHand[HandSegment.Back].length;

      if (frontCount !== 3 || middleCount !== 5 || backCount !== 5) {
          setErrorMsg(`牌数错误：头墩3张(${frontCount})，中墩5张(${middleCount})，尾墩5张(${backCount})`);
          return;
      }

      setGameState('showdown');
      setTimeout(() => setShowResult(true), 1500);
  };

  return {
    gameState,
    arrangedHand,
    selectedCards,
    showResult,
    currentTable,
    currentSeat,
    errorMsg,
    handleJoinGame,
    exitGame,
    handleCardInteraction,
    handleRowClick,
    handleSubmit,
    startGame 
  };
};
