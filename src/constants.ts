import { Card, Rank, Suit } from './types';

export const CARD_RANKS = [
  { rank: Rank.Three, label: '3', value: 3 },
  { rank: Rank.Four, label: '4', value: 4 },
  { rank: Rank.Five, label: '5', value: 5 },
  { rank: Rank.Six, label: '6', value: 6 },
  { rank: Rank.Seven, label: '7', value: 7 },
  { rank: Rank.Eight, label: '8', value: 8 },
  { rank: Rank.Nine, label: '9', value: 9 },
  { rank: Rank.Ten, label: '10', value: 10 },
  { rank: Rank.Jack, label: 'J', value: 11 },
  { rank: Rank.Queen, label: 'Q', value: 12 },
  { rank: Rank.King, label: 'K', value: 13 },
  { rank: Rank.Ace, label: 'A', value: 14 },
  { rank: Rank.Two, label: '2', value: 16 } // 2 is higher than Ace in Dou Dizhu
];

export const SUITS = [
  { suit: Suit.Diamonds, color: 'red' as const },
  { suit: Suit.Clubs, color: 'black' as const },
  { suit: Suit.Hearts, color: 'red' as const },
  { suit: Suit.Spades, color: 'black' as const },
];

export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  let idCounter = 0;

  SUITS.forEach(s => {
    CARD_RANKS.forEach(r => {
      deck.push({
        id: `card-${idCounter++}`,
        suit: s.suit,
        rank: r.rank,
        label: r.label,
        color: s.color,
        value: r.value
      });
    });
  });

  // Jokers
  deck.push({
    id: `card-${idCounter++}`,
    suit: Suit.None,
    rank: Rank.BlackJoker,
    label: 'Joker',
    color: 'black',
    value: 20
  });

  deck.push({
    id: `card-${idCounter++}`,
    suit: Suit.None,
    rank: Rank.RedJoker,
    label: 'Joker',
    color: 'red',
    value: 21
  });

  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const shuffleDeckNoShuffle = (deck: Card[]): Card[] => {
  // Simulate "No Shuffle" (不洗牌) mode:
  // Creates a deck with high probability of bombs and sequences.
  
  // 1. Sort by Rank to create initial clumps
  let tempDeck = [...deck].sort((a, b) => a.value - b.value); 
  
  // 2. Cut the deck into random chunks (e.g., 5-8 chunks) to keep sequences/bombs together
  const chunks: Card[][] = [];
  while (tempDeck.length > 0) {
    // Random chunk size between 4 and 10 cards
    const chunkSize = Math.floor(Math.random() * 7) + 4; 
    chunks.push(tempDeck.splice(0, chunkSize));
  }
  
  // 3. Shuffle the chunks order
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }
  
  // 4. Flatten back to deck
  let stackedDeck = chunks.flat();
  
  // 5. Add a little noise (swap ~15 random pairs) to prevent it being too artificial
  for (let k = 0; k < 15; k++) {
     const i = Math.floor(Math.random() * stackedDeck.length);
     const j = Math.floor(Math.random() * stackedDeck.length);
     [stackedDeck[i], stackedDeck[j]] = [stackedDeck[j], stackedDeck[i]];
  }
  
  return stackedDeck;
};