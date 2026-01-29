
export enum Suit {
  Spades = '♠',
  Hearts = '♥',
  Clubs = '♣',
  Diamonds = '♦'
}

export enum Rank {
  Two = '2', Three = '3', Four = '4', Five = '5', Six = '6', Seven = '7',
  Eight = '8', Nine = '9', Ten = '10', Jack = 'J', Queen = 'Q', King = 'K', Ace = 'A'
}

export interface CardType {
  id: string; // Unique identifier for React keys
  suit: Suit;
  rank: Rank;
  value: number; // Numeric value for comparison (2=2, ..., A=14)
}

export enum HandSegment {
  Front = 'front',   // 3 cards
  Middle = 'middle', // 5 cards
  Back = 'back'      // 5 cards
}

export interface PlayerHand {
  [HandSegment.Front]: CardType[];
  [HandSegment.Middle]: CardType[];
  [HandSegment.Back]: CardType[];
}

export interface GameState {
  phase: 'lobby' | 'dealing' | 'arranging' | 'showdown';
  playerHand: CardType[]; // The 13 cards dealt to player
  arrangedHand: PlayerHand;
  tableId: number | null;
  seatId: string | null;
  opponents: { id: number; name: string; isReady: boolean }[];
}
