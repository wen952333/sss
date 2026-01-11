
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
  GAME_OVER, 
  SETTLEMENT_VIEW 
}

export enum HandType {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIRS = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
}

// Seat positions
export type Seat = 'North' | 'South' | 'East' | 'West';

// A single pre-generated deal (Table)
export interface TableData {
  id: number; // 0-9 within a carriage
  hands: Record<Seat, Card[]>;
}

// A Carriage contains 10 Tables
export interface CarriageData {
  id: number; // 1-20
  tables: TableData[];
}

// Player's submission for a specific table
export interface HandSubmission {
  carriageId: number; 
  roundId: number;    // The logical "Carriage Number" (1st time, 2nd time...)
  tableId: number;
  seat: Seat;
  hand: PlayerHand;
  timestamp: number;
  playerId?: string; 
  name?: string;     
  isAuto?: boolean; // If auto-submitted by system
}

// The result of one table comparison
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

// User Info from Backend
export interface User {
  id: number;
  phone: string;
  nickname: string;
  points: number;
  token?: string; 
}

// Global Game State
export interface GameState {
  phase: GamePhase;
  user: User | null; 
  
  // Current Session Info
  currentCarriageId: number; // This is the Lobby/Event ID (e.g. 1=8pm Event)
  currentRound: number;      // This is the sequential Carriage number (1, 2, 3...)
  currentTableIndex: number; // 0-9
  tableQueue: number[]; 
  mySeat: Seat;
  
  // Current Hand Data
  currentCards: Card[]; 
  currentArrangement: PlayerHand;
  
  // Progress
  submissions: HandSubmission[]; 
  
  // Final Report
  settlementReport: {
    totalScore: number;
    details: TableResult[]; // Flat list of all results
    groupedResults?: Record<number, TableResult[]>; // Grouped by Round (Carriage)
  } | null;

  // Local Algo Suggestions
  aiSuggestions: PlayerHand[];
  currentSuggestionIndex: number;
}
