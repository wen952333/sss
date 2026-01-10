import { Card, PlayerHand, Suit, Rank } from "../types";

// --- Types & Constants ---
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
  values: number[]; // Main rank values for comparison (e.g. pair rank, kickers)
  cards: Card[];
}

// --- Helpers ---

// Get numeric value for Rank (2=2, ..., A=14)
const getRankValue = (r: Rank): number => r;

// Sort cards by rank descending
const sortCards = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

// --- Hand Evaluation Logic ---

// Evaluate a 5-card hand
export const evaluate5 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  const isFlush = cards.every(c => c.suit === cards[0].suit);
  
  // Check Straight
  let isStraight = true;
  for (let i = 0; i < 4; i++) {
    if (ranks[i] - ranks[i+1] !== 1) {
      // Special case: A-5-4-3-2 (14, 5, 4, 3, 2)
      if (i === 0 && ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
        continue;
      }
      isStraight = false;
      break;
    }
  }
  // Adjust A-5-4-3-2 ranks for comparison (5 is high)
  if (isStraight && ranks[0] === 14 && ranks[1] === 5) {
      // It's a wheel. Value is 5.
      // But for simple comparison logic, let's keep array but know it's low straight.
  }

  // Rank Counts
  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const countValues = Object.values(counts);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => counts[b] - counts[a] || b - a); // Sort by count then rank

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

// Evaluate a 3-card hand (Top)
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

// Compare two analyzed hands. Returns >0 if h1 > h2, <0 if h2 > h1, 0 if equal.
export const compareHands = (h1: AnalyzedHand, h2: AnalyzedHand): number => {
  if (h1.type !== h2.type) return h1.type - h2.type;
  
  for (let i = 0; i < h1.values.length; i++) {
    if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
  }
  return 0;
};

// --- Solver Strategy ---

// Helper to get combinations of k elements
function* combinations<T>(elements: T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return; }
  for (let i = 0; i <= elements.length - k; i++) {
    const first = elements[i];
    for (const rest of combinations(elements.slice(i + 1), k - 1)) {
      yield [first, ...rest];
    }
  }
}

// Find all valid 5-card combinations that form a specific type or better, optimizing simply
// Since C(13,5) = 1287, we can iterate all.
const getCandidateHands = (cards: Card[], size: 3 | 5): AnalyzedHand[] => {
  const candidates: AnalyzedHand[] = [];
  const evaluator = size === 5 ? evaluate5 : evaluate3;
  
  // Optimization: Don't generate ALL combinations if we just want the best.
  // But for accurate pattern matching, we kind of need to check many.
  // Let's iterate all C(13,5) for bottom. It's fast enough in JS (~1ms).
  
  const iter = combinations(cards, size);
  for (const combo of iter) {
    const evalResult = evaluator(combo);
    // Filter out very weak hands to save memory if needed, but for 13 cards it's fine.
    candidates.push(evalResult);
  }
  
  // Sort candidates by strength descending
  return candidates.sort((a, b) => compareHands(b, a));
};

export const getLocalSuggestions = (cards: Card[]): PlayerHand[] => {
  // 1. Generate all possible 5-card hands from the 13 cards
  // This gives us candidates for Bottom and Middle.
  const all5 = getCandidateHands(cards, 5);
  
  // We want to find valid arrangements (B, M, T) where B >= M >= T.
  const solutions: { hand: PlayerHand, score: number, desc: string }[] = [];
  
  // Strategy: Beam Search / Greedy-ish
  // Take top X distinct patterns for Bottom.
  // For each Bottom, take top Y distinct patterns for Middle from remaining.
  // Remaining is Top.
  
  // Dedup top hands slightly (e.g. if we have multiple flushes, pick best ones)
  // We take the top 30 valid 5-card hands as candidates for Bottom
  const bottomCandidates = all5.slice(0, 50); 
  
  const seenLayouts = new Set<string>();

  for (const bot of bottomCandidates) {
    // Determine remaining cards
    const botIds = new Set(bot.cards.map(c => c.id));
    const remaining8 = cards.filter(c => !botIds.has(c.id));
    
    // Find best Middle from remaining 8
    // C(8,5) = 56 combinations. Very fast.
    const middleCandidates = getCandidateHands(remaining8, 5);
    
    for (const mid of middleCandidates) {
      // Check Rule: Bottom >= Middle
      if (compareHands(bot, mid) < 0) continue; // Invalid
      
      const midIds = new Set(mid.cards.map(c => c.id));
      const remaining3 = remaining8.filter(c => !midIds.has(c.id));
      const top = evaluate3(remaining3);
      
      // Check Rule: Middle >= Top
      // Note: evaluate3 returns types like Pair, HighCard.
      // HandType enum is consistent (1-9).
      // We must treat Top Trips (4) as less than Middle Straight (5) etc.
      // Logic holds directly because enum values align for standard types.
      // Only caveat: Top cannot have Straight/Flush/FullHouse/4K/SF.
      if (compareHands(mid, top) < 0) continue; // Invalid

      // We found a valid hand!
      const layoutKey = [bot.type, mid.type, top.type].join('-');
      
      // Calculate a rough "score" to rank solutions
      // Weighted sum of types + kickers
      const score = (bot.type * 100) + (mid.type * 10) + top.type; 
      
      solutions.push({
        hand: { top: top.cards, middle: mid.cards, bottom: bot.cards },
        score,
        desc: `${HandType[bot.type]} / ${HandType[mid.type]} / ${HandType[top.type]}`
      });
      
      // Optimization: Only keep best middle for this bottom to ensure diversity in Bottoms
      break; 
    }
  }

  // Sort solutions by score
  solutions.sort((a, b) => b.score - a.score);

  // Select 3 diverse suggestions
  // 1. Best overall (Greedy max)
  // 2. Best special pattern if any (e.g. 3 Flushes?), or just second best
  // 3. Balanced?

  // Let's just return unique top 3 hands based on card IDs
  const finalSuggestions: PlayerHand[] = [];
  const addedSignatures = new Set<string>();

  for (const sol of solutions) {
    // Create a signature based on bottom cards (sorted)
    const sig = sol.hand.bottom.map(c => c.id).sort().join(',');
    if (!addedSignatures.has(sig)) {
      finalSuggestions.push(sol.hand);
      addedSignatures.add(sig);
    }
    if (finalSuggestions.length >= 3) break;
  }

  // Fallback if no valid hands found (extremely rare unless 13 distinct cards with no combos? virtually impossible)
  // Just return sorted by rank
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