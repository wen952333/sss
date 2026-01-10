import { Card, Suit, Rank } from '../types';

const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    });
  });
  return shuffle(deck);
};

export const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const dealCards = (deck: Card[], count: number = 13): { dealt: Card[], remaining: Card[] } => {
  const dealt = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { dealt, remaining };
};

export const getRankSymbol = (rank: Rank): string => {
  switch (rank) {
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    case 14: return 'A';
    default: return rank.toString();
  }
};

export const getSuitSymbol = (suit: Suit): string => {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'spades': return '♠';
    case 'clubs': return '♣';
  }
};

export const getSuitColor = (suit: Suit): string => {
  return (suit === 'hearts' || suit === 'diamonds') ? 'text-red-500' : 'text-slate-900';
};

export const getCardSvgName = (card: Card): string => {
  let rankStr = card.rank.toString();
  if (card.rank === 11) rankStr = 'jack';
  else if (card.rank === 12) rankStr = 'queen';
  else if (card.rank === 13) rankStr = 'king';
  else if (card.rank === 14) rankStr = 'ace';

  return `${rankStr}_of_${card.suit}.svg`;
};
