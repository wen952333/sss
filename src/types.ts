
export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠',
  None = '' // For Jokers
}

export enum Rank {
  Three = 3, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace, Two,
  BlackJoker = 20,
  RedJoker = 21
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  label: string;
  color: 'red' | 'black';
  value: number; // For comparison logic (3 is lowest, Joker highest)
}

export enum PlayerRole {
  Peasant = '农民',
  Landlord = '地主'
}

export enum GamePhase {
  MainMenu = 'MAIN_MENU',
  RoomLobby = 'ROOM_LOBBY', // 新增：房间等待阶段
  Dealing = '发牌中',
  Bidding = '叫地主',
  Playing = '游戏中',
  GameOver = '游戏结束'
}

export enum GameMode {
  PvE = 'PVE',
  Friends = 'FRIENDS',
  Match = 'MATCH'
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  role: PlayerRole | null;
  isHuman: boolean;
  passes: number; // consecutive passes
  isReady?: boolean; // 新增：多人模式准备状态
}

export interface Move {
  playerId: number;
  cards: Card[];
  type: HandType;
}

export enum HandType {
  Single = '单张',
  Pair = '对子',
  Triple = '三张',
  TripleWithOne = '三带一',
  TripleWithPair = '三带二',
  Straight = '顺子',
  Bomb = '炸弹',
  Rocket = '王炸', // Double Joker
  Pass = '过',
  Invalid = '无效'
}

export interface GameState {
  deck: Card[];
  players: Player[];
  phase: GamePhase;
  mode: GameMode; // 新增：当前游戏模式
  landlordCards: Card[];
  currentTurnIndex: number; // 0, 1, 2
  lastMove: Move | null;
  winnerId: number | null;
  multiplier: number;
  baseScore: number;
  bidsCount: number;
  roomId?: string; // 新增：房间ID
}

export interface User {
  telegram_id: number;
  username: string;
  points: number;
  last_check_in_date: string | null;
  is_admin: boolean;
}

// 新增：支付记录接口
export interface PaymentRecord {
  id: number;
  telegram_id: number;
  username: string;
  amount: number; // 星星数量
  product: string;
  telegram_payment_charge_id: string;
  created_at: string;
}
