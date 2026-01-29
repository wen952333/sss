
import { CardType, Rank, Suit } from "../types";
import { RANK_VALUES } from "../constants";

export const createDeck = (): CardType[] => {
  const deck: CardType[] = [];
  Object.values(Suit).forEach((suit) => {
    Object.values(Rank).forEach((rank) => {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: RANK_VALUES[rank],
      });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: CardType[]): CardType[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const dealCards = (): CardType[][] => {
  const deck = shuffleDeck(createDeck());
  const hands: CardType[][] = [[], [], [], []];
  // Deal 13 cards to 4 players
  for (let i = 0; i < 52; i++) {
    hands[i % 4].push(deck[i]);
  }
  
  // Sort hands by value descending for easier viewing
  hands.forEach(hand => hand.sort((a, b) => b.value - a.value));
  return hands;
};

// Simple text formatter for Gemini prompt
export const formatHandForPrompt = (cards: CardType[]): string => {
  return cards.map(c => `${c.rank}${c.suit}`).join(', ');
};

export const parseCardString = (cardStr: string, allCards: CardType[]): CardType | undefined => {
  const cleanStr = cardStr.trim();
  return allCards.find(c => {
    const str = `${c.rank}${c.suit}`;
    return str === cleanStr || cleanStr.includes(str);
  });
};

/**
 * Converts CardType to SVG filename path
 * Pattern: {rank}_of_{suit}.svg
 * Examples: ace_of_spades.svg, 10_of_clubs.svg
 */
export const getCardAssetPath = (card: CardType): string => {
  const suitMap: Record<Suit, string> = {
    [Suit.Spades]: 'spades',
    [Suit.Hearts]: 'hearts',
    [Suit.Clubs]: 'clubs',
    [Suit.Diamonds]: 'diamonds'
  };

  const rankMap: Record<string, string> = {
    'A': 'ace',
    'K': 'king',
    'Q': 'queen',
    'J': 'jack'
  };

  const suitName = suitMap[card.suit];
  // If it's A, K, Q, J use the word, otherwise use the number (e.g., '10', '2')
  const rankName = rankMap[card.rank] || card.rank;

  return `/cards/${rankName}_of_${suitName}.svg`;
};
