
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
  PLAYING, // In the loop of 10 hands
  SETTLEMENT_VIEW // Viewing the report card
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
  tableId: number;
  seat: Seat;
  hand: PlayerHand;
  timestamp: number;
  playerId?: string; // Optional for local storage
  name?: string;     // Optional for local storage
}

// The result of one table comparison
export interface TableResult {
  tableId: number;
  playersInvolved: string[]; // Names of players who submitted
  scores: Record<string, number>; // playerId -> score change
  // ADDED: Detailed submissions to render the board
  details: {
      playerId: string;
      name: string;
      seat: Seat;
      hand: PlayerHand;
      score: number; // Total score for this table
      specialType?: string; // If they played a special hand
  }[];
  voided: boolean; // True if < 2 players
}

// User Info from Backend
export interface User {
  id: number;
  phone: string;
  nickname: string;
  points: number;
  token?: string; // Simple session token
}

// Global Game State
export interface GameState {
  phase: GamePhase;
  user: User | null; // Logged in user
  
  // Current Session Info
  currentCarriageId: number;
  currentTableIndex: number; // Index in the randomized queue (0-9)
  tableQueue: number[]; // Randomized list of table IDs (e.g. [3, 9, 1...])
  mySeat: Seat;
  
  // Current Hand Data
  currentCards: Card[]; // The cards dealing to player right now
  currentArrangement: PlayerHand;
  
  // Progress
  submissions: HandSubmission[]; // Local tracking of what I've done
  
  // Final Report
  settlementReport: {
    totalScore: number;
    details: TableResult[];
    validCarriageCount: number;
  } | null;
  
  // AI/Helper
  aiSuggestions: PlayerHand[];
  currentSuggestionIndex: number;
}
