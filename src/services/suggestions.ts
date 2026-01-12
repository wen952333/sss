
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
  meta?: {
    isWheel?: boolean; // A-2-3-4-5
    topCard?: Card;
  };
}

const getRankValue = (r: Rank): number => r;

// Sort cards by rank descending
const sortCards = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

const getSuitValue = (s: Suit): number => {
  switch (s) {
    case 'spades': return 4;
    case 'hearts': return 3;
    case 'clubs': return 2;
    case 'diamonds': return 1;
  }
};

export const evaluate5 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  const isFlush = cards.every(c => c.suit === cards[0].suit);
  
  let isStraight = true;
  let isWheel = false;

  for (let i = 0; i < 4; i++) {
    if (ranks[i] - ranks[i+1] !== 1) {
      // Check for Wheel: A(14), 5, 4, 3, 2
      if (i === 0 && ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
        isWheel = true;
        continue;
      }
      isStraight = false;
      break;
    }
  }

  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => counts[b] - counts[a] || b - a);
  const countValues = Object.values(counts);
  
  // Top card logic for tie-breakers (simplified)
  const topCard = sorted[0]; 
  const meta = { isWheel, topCard };

  if (isStraight && isFlush) return { type: HandType.STRAIGHT_FLUSH, values: ranks, cards: sorted, meta };
  if (countValues.includes(4)) return { type: HandType.FOUR_OF_A_KIND, values: uniqueRanks, cards: sorted, meta };
  if (countValues.includes(3) && countValues.includes(2)) return { type: HandType.FULL_HOUSE, values: uniqueRanks, cards: sorted, meta };
  if (isFlush) return { type: HandType.FLUSH, values: ranks, cards: sorted, meta };
  if (isStraight) return { type: HandType.STRAIGHT, values: ranks, cards: sorted, meta };
  if (countValues.includes(3)) return { type: HandType.THREE_OF_A_KIND, values: uniqueRanks, cards: sorted, meta };
  if (countValues.filter(x => x === 2).length === 2) return { type: HandType.TWO_PAIRS, values: uniqueRanks, cards: sorted, meta };
  if (countValues.includes(2)) return { type: HandType.ONE_PAIR, values: uniqueRanks, cards: sorted, meta };
  
  return { type: HandType.HIGH_CARD, values: ranks, cards: sorted, meta };
};

export const evaluate3 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  
  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => counts[b] - counts[a] || b - a);
  const countValues = Object.values(counts);
  const topCard = sorted[0];
  const meta = { topCard };

  if (countValues.includes(3)) return { type: HandType.THREE_OF_A_KIND, values: uniqueRanks, cards: sorted, meta };
  if (countValues.includes(2)) return { type: HandType.ONE_PAIR, values: uniqueRanks, cards: sorted, meta };
  
  return { type: HandType.HIGH_CARD, values: ranks, cards: sorted, meta };
};

const getStraightEffectiveValue = (h: AnalyzedHand): number => {
  if (h.meta?.isWheel) return 5; // A-2-3-4-5 counts as 5-high straight (lowest)
  return h.values[0];
};

export const compareHands = (h1: AnalyzedHand, h2: AnalyzedHand): number => {
  if (h1.type !== h2.type) return h1.type - h2.type;

  if (h1.type === HandType.STRAIGHT || h1.type === HandType.STRAIGHT_FLUSH) {
      const v1 = getStraightEffectiveValue(h1);
      const v2 = getStraightEffectiveValue(h2);
      if (v1 !== v2) return v1 - v2;
      
      // Tie-breaker: Suit of top card
      const s1 = getSuitValue(h1.meta!.topCard!.suit);
      const s2 = getSuitValue(h2.meta!.topCard!.suit);
      return s1 - s2;
  }

  if (h1.type === HandType.FLUSH) {
      // Compare ranks first
      for (let i = 0; i < h1.values.length; i++) {
        if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
      }
      // Compare suit
      const s1 = getSuitValue(h1.cards[0].suit);
      const s2 = getSuitValue(h2.cards[0].suit);
      return s1 - s2;
  }

  // Standard Comparison (Quads, Full House, Trips, Pairs, High Card)
  for (let i = 0; i < h1.values.length; i++) {
    if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
  }

  // Final tie breaker (kickers equal): Suit of top card
  if (h1.cards.length > 0 && h2.cards.length > 0) {
      const s1 = getSuitValue(h1.cards[0].suit);
      const s2 = getSuitValue(h2.cards[0].suit);
      return s1 - s2;
  }

  return 0;
};

// --- Scoring Logic ---

/**
 * Calculates a heuristic score for a hand in a specific lane.
 * Higher is better. Includes bonus points for special hands ("Water").
 */
const getLaneScore = (hand: AnalyzedHand, lane: 'top' | 'middle' | 'bottom'): number => {
    // Base Power: Type * 100
    // 1=100, 2=200 ... 9=900
    let score = hand.type * 100;
    
    // Add Rank value for fine-tuning (0-15 points)
    // Helps distinguish Ace Pair (214) vs 2 Pair (202)
    score += hand.values[0]; 

    // --- Bonus "Water" Points ---
    // Approximating 1 water ~= 100 score points to prioritize winning bonuses
    
    if (lane === 'top') {
        if (hand.type === HandType.THREE_OF_A_KIND) score += 300; // +3 water
        if (hand.type === HandType.ONE_PAIR) score += 50; // Top pair is strong
    }
    else if (lane === 'middle') {
        if (hand.type === HandType.FULL_HOUSE) score += 200; // +2 water
        if (hand.type === HandType.FOUR_OF_A_KIND) score += 800; // +8 water
        if (hand.type === HandType.STRAIGHT_FLUSH) score += 1000; // +10 water
    }
    else if (lane === 'bottom') {
        if (hand.type === HandType.FOUR_OF_A_KIND) score += 400; // +4 water
        if (hand.type === HandType.STRAIGHT_FLUSH) score += 500; // +5 water
    }

    return score;
};

// --- Validation Logic ---

export const isValidArrangement = (hand: PlayerHand): { valid: boolean, error?: string } => {
    const top = evaluate3(hand.top);
    const mid = evaluate5(hand.middle);
    const bot = evaluate5(hand.bottom);

    if (compareHands(mid, bot) > 0) {
        return { valid: false, error: "中墩不能大于尾墩 (倒水)" };
    }

    if (compareHands(top, mid) > 0) {
        return { valid: false, error: "头墩不能大于中墩 (倒水)" };
    }

    return { valid: true };
};

// --- Solver Strategy ---

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
  
  // Sort by raw strength
  return candidates.sort((a, b) => compareHands(b, a));
};

export const getLocalSuggestions = (cards: Card[]): PlayerHand[] => {
  // 1. Generate all possible Bottom hands
  const all5 = getCandidateHands(cards, 5);
  const solutions: { hand: PlayerHand, totalScore: number }[] = [];
  
  // 2. Optimization: Iterate through best Bottom candidates
  // Increased limit to 300 to consider weaker bottoms that allow stronger middles (Balanced Strategy)
  const bottomCandidates = all5.slice(0, 300); 
  
  for (const bot of bottomCandidates) {
    const botScore = getLaneScore(bot, 'bottom');
    
    // Remaining cards for Middle + Top
    const botIds = new Set(bot.cards.map(c => c.id));
    const remaining8 = cards.filter(c => !botIds.has(c.id));
    
    // Generate Middle candidates
    const middleCandidates = getCandidateHands(remaining8, 5);
    
    for (const mid of middleCandidates) {
      // Pruning: Bottom must be >= Middle
      if (compareHands(mid, bot) > 0) continue; 
      
      const midScore = getLaneScore(mid, 'middle');
      
      // Remaining cards for Top
      const midIds = new Set(mid.cards.map(c => c.id));
      const remaining3 = remaining8.filter(c => !midIds.has(c.id));
      const top = evaluate3(remaining3);
      
      // Pruning: Middle must be >= Top
      if (compareHands(top, mid) > 0) continue; 

      const topScore = getLaneScore(top, 'top');

      // 3. Final Score
      // Summing scores creates a balanced evaluation
      // e.g., Bot Flush (600) + Mid Flush (600) = 1200
      // vs Bot FullHouse (700) + Mid HighCard (100) = 800
      // This logic will prefer the Double Flush.
      const totalScore = botScore + midScore + topScore;
      
      solutions.push({
        hand: { top: top.cards, middle: mid.cards, bottom: bot.cards },
        totalScore
      });
      
      // Optimization: For a specific Bottom, we usually only care about the best Middle configuration.
      // However, sometimes a slightly weaker Middle might leave a much stronger Top.
      // Since `middleCandidates` is sorted, the first valid one is usually the best Mid+Top combo roughly.
      // But to be safe, we can check a few or just break. 
      // Given simple heuristic `Mid >= Top`, the best Mid usually leaves a weak Top, 
      // but maximizing Mid is usually better than saving for Top unless Top becomes Trips.
      // Let's break here for performance to keep it fast (Greedy inner loop).
      break; 
    }
  }

  // 4. Sort solutions by Total Score
  solutions.sort((a, b) => b.totalScore - a.totalScore);

  // 5. Select diverse top suggestions
  const finalSuggestions: PlayerHand[] = [];
  const addedSignatures = new Set<string>();

  for (const sol of solutions) {
    // Signature based on Bottom+Middle types to ensure variety
    const botType = evaluate5(sol.hand.bottom).type;
    const midType = evaluate5(sol.hand.middle).type;
    const sig = `${botType}-${midType}-${sol.hand.bottom.map(c=>c.id).sort().join(',')}`;
    
    // Relaxed dedup: mostly check exact bottom cards
    const cardSig = sol.hand.bottom.map(c => c.id).sort().join(',');

    if (!addedSignatures.has(cardSig)) {
      finalSuggestions.push(sol.hand);
      addedSignatures.add(cardSig);
    }
    if (finalSuggestions.length >= 3) break;
  }

  // Fallback
  if (finalSuggestions.length === 0) {
      const sorted = sortCards(cards);
      finalSuggestions.push({
          bottom: sorted.slice(0, 5),
          middle: sorted.slice(5, 10),
          top: sorted.slice(10, 13)
      });
  }

  return finalSuggestions;
};
