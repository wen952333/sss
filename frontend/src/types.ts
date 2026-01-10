export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface PlayerHand {
  top: Card[];
  middle: Card[];
  bottom: Card[];
}

export enum GamePhase {
  LOBBY,
  PLAYING,
  SETTLEMENT_VIEW
}

export type Seat = 'North' | 'South' | 'East' | 'West';

export interface TableData {
  id: number;
  hands: Record<Seat, Card[]>;
}

export interface CarriageData {
  id: number;
  tables: TableData[];
}

export interface HandSubmission {
  carriageId: number;
  tableId: number;
  seat: Seat;
  hand: PlayerHand;
  timestamp: number;
  playerId?: string;
  name?: string;
}

export interface TableResult {
  tableId: number;
  playersInvolved: string[];
  scores: Record<string, number>;
  details: {
      playerId: string;
      name: string;
      seat: Seat;
      hand: PlayerHand;
      score: number;
      specialType?: string;
  }[];
  voided: boolean;
}

export interface User {
  id: number;
  phone: string;
  nickname: string;
  points: number;
  token?: string;
}

export interface GameState {
  phase: GamePhase;
  user: User | null;
  currentCarriageId: number;
  currentTableIndex: number;
  tableQueue: number[];
  mySeat: Seat;
  currentCards: Card[];
  currentArrangement: PlayerHand;
  submissions: HandSubmission[];
  settlementReport: {
    totalScore: number;
    details: TableResult[];
    validCarriageCount: number;
  } | null;
  aiSuggestions: PlayerHand[];
  currentSuggestionIndex: number;
}