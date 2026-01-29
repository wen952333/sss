
import { Rank, Suit } from "./types";

export const RANK_VALUES: Record<Rank, number> = {
  [Rank.Two]: 2, [Rank.Three]: 3, [Rank.Four]: 4, [Rank.Five]: 5,
  [Rank.Six]: 6, [Rank.Seven]: 7, [Rank.Eight]: 8, [Rank.Nine]: 9,
  [Rank.Ten]: 10, [Rank.Jack]: 11, [Rank.Queen]: 12, [Rank.King]: 13, [Rank.Ace]: 14
};

export const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Spades]: 'text-gray-900',
  [Suit.Hearts]: 'text-red-600',
  [Suit.Clubs]: 'text-green-700',
  [Suit.Diamonds]: 'text-blue-600'
};

export const OPPONENTS = [
  { id: 1, name: "阿龙", isReady: true },
  { id: 2, name: "小虎", isReady: true },
  { id: 3, name: "老凤", isReady: true },
];
