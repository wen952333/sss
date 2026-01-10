import { Card, PlayerHand, Suit, Rank } from "../types";

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

export interface AnalyzedHand {
  type: HandType;
  values: number[];
  cards: Card[];
}

const getRankValue = (r: Rank): number => r;

const sortCards = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

export const evaluate5 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  const isFlush = cards.every(c => c.suit === cards[0].suit);
  
  let isStraight = true;
  for (let i = 0; i < 4; i++) {
    if (ranks[i] - ranks[i+1] !== 1) {
      if (i === 0 && ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
        continue;
      }
      isStraight = false;
      break;
    }
  }

  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const countValues = Object.values(counts);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => counts[b] - counts[a] || b - a);

  if (isStraight && isFlush) return { type: HandType.STRAIGHT_FLUSH, values: ranks, cards: sorted };
  if (countValues.includes(4)) return { type: HandType.FOUR_OF_A_KIND, values: uniqueRanks, cards: sorted };
  if (countValues.includes(3) && countValues.includes(2)) return { type: HandType.FULL_HOUSE, values: uniqueRanks, cards: sorted };
  if (isFlush) return { type: HandType.FLUSH, values: ranks, cards: sorted };
  if (isStraight) return { type: HandType.STRAIGHT, values: ranks, cards: sorted };
  if (countValues.includes(3)) return { type: HandType.THREE_OF_A_KIND, values: uniqueRanks, cards: sorted };
  if (countValues.filter(x => x === 2).length === 2) return { type: HandType.TWO_PAIRS, values: uniqueRanks, cards: sorted };
  if (countValues.includes(2)) return { type: HandType.ONE_PAIR, values: uniqueRanks, cards: sorted };
  
  return { type: HandType.HIGH_CARD, values: ranks, cards: sorted };
};

export const evaluate3 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  
  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const countValues = Object.values(counts);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => counts[b] - counts[a] || b - a);

  if (countValues.includes(3)) return { type: HandType.THREE_OF_A_KIND, values: uniqueRanks, cards: sorted };
  if (countValues.includes(2)) return { type: HandType.ONE_PAIR, values: uniqueRanks, cards: sorted };
  
  return { type: HandType.HIGH_CARD, values: ranks, cards: sorted };
};

export const compareHands = (h1: AnalyzedHand, h2: AnalyzedHand): number => {
  if (h1.type !== h2.type) return h1.type - h2.type;
  for (let i = 0; i < h1.values.length; i++) {
    if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
  }
  return 0;
};

function* combinations<T>(elements: T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return; }
  for (let i = 0; i <= elements.length - k; i++) {
    const first = elements[i];
    for (const rest of combinations(elements.slice(i + 1), k - 1)) {
      yield [first, ...rest];
    }
  }
}

const getCandidateHands = (cards: Card[], size: 3 | 5): AnalyzedHand[] => {
  const candidates: AnalyzedHand[] = [];
  const evaluator = size === 5 ? evaluate5 : evaluate3;
  
  const iter = combinations(cards, size);
  for (const combo of iter) {
    candidates.push(evaluator(combo));
  }
  
  return candidates.sort((a, b) => compareHands(b, a));
};

export const getLocalSuggestions = (cards: Card[]): PlayerHand[] => {
  const all5 = getCandidateHands(cards, 5);
  const solutions: { hand: PlayerHand, score: number, desc: string }[] = [];
  const bottomCandidates = all5.slice(0, 50); 
  
  for (const bot of bottomCandidates) {
    const botIds = new Set(bot.cards.map(c => c.id));
    const remaining8 = cards.filter(c => !botIds.has(c.id));
    const middleCandidates = getCandidateHands(remaining8, 5);
    
    for (const mid of middleCandidates) {
      if (compareHands(bot, mid) < 0) continue; 
      
      const midIds = new Set(mid.cards.map(c => c.id));
      const remaining3 = remaining8.filter(c => !midIds.has(c.id));
      const top = evaluate3(remaining3);
      
      if (compareHands(mid, top) < 0) continue; 

      const score = (bot.type * 100) + (mid.type * 10) + top.type; 
      
      solutions.push({
        hand: { top: top.cards, middle: mid.cards, bottom: bot.cards },
        score,
        desc: `${HandType[bot.type]} / ${HandType[mid.type]} / ${HandType[top.type]}`
      });
      break; 
    }
  }

  solutions.sort((a, b) => b.score - a.score);

  const finalSuggestions: PlayerHand[] = [];
  const addedSignatures = new Set<string>();

  for (const sol of solutions) {
    const sig = sol.hand.bottom.map(c => c.id).sort().join(',');
    if (!addedSignatures.has(sig)) {
      finalSuggestions.push(sol.hand);
      addedSignatures.add(sig);
    }
    if (finalSuggestions.length >= 3) break;
  }

  if (finalSuggestions.length === 0) {
      const sorted = sortCards(cards);
      finalSuggestions.push({
          top: sorted.slice(10, 13),
          middle: sorted.slice(5, 10),
          bottom: sorted.slice(0, 5)
      });
  }

  return finalSuggestions;
};