import { Card, HandType, Rank } from '../types';

export const sortCards = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => b.value - a.value);
};

export const determineHandType = (cards: Card[]): { type: HandType; value: number } => {
  const sorted = sortCards(cards);
  const len = sorted.length;

  if (len === 0) return { type: HandType.Pass, value: 0 };

  // Single
  if (len === 1) return { type: HandType.Single, value: sorted[0].value };

  // Rocket (Double Joker)
  if (len === 2 && sorted[0].rank === Rank.RedJoker && sorted[1].rank === Rank.BlackJoker) {
    return { type: HandType.Rocket, value: 999 };
  }

  // Pair
  if (len === 2 && sorted[0].value === sorted[1].value) {
    return { type: HandType.Pair, value: sorted[0].value };
  }

  // Triple
  if (len === 3 && sorted[0].value === sorted[2].value) {
    return { type: HandType.Triple, value: sorted[0].value };
  }

  // Bomb (4 of a kind)
  if (len === 4 && sorted[0].value === sorted[3].value) {
    return { type: HandType.Bomb, value: sorted[0].value };
  }

  // Triple with One
  if (len === 4) {
    // 3+1 (Trips are either at start or end)
    if (sorted[0].value === sorted[2].value) return { type: HandType.TripleWithOne, value: sorted[0].value };
    if (sorted[1].value === sorted[3].value) return { type: HandType.TripleWithOne, value: sorted[1].value };
  }

  // Triple with Pair
  if (len === 5) {
    // 3+2
    if (sorted[0].value === sorted[2].value && sorted[3].value === sorted[4].value) 
      return { type: HandType.TripleWithPair, value: sorted[0].value };
    if (sorted[0].value === sorted[1].value && sorted[2].value === sorted[4].value)
      return { type: HandType.TripleWithPair, value: sorted[2].value };
  }

  // Straight (5+ consecutive singles, no 2 or Joker)
  if (len >= 5) {
    let isStraight = true;
    for (let i = 0; i < len - 1; i++) {
      if (sorted[i].value !== sorted[i+1].value + 1) isStraight = false;
      if (sorted[i].value >= Rank.Two) isStraight = false; // No 2s or Jokers
    }
    if (isStraight) return { type: HandType.Straight, value: sorted[0].value }; // Highest card value
  }

  return { type: HandType.Invalid, value: 0 };
};

export const canPlayHand = (currentCards: Card[], lastCards: Card[] | null, lastType: HandType | null, lastValue: number): boolean => {
  const currentHand = determineHandType(currentCards);
  
  // Invalid move
  if (currentHand.type === HandType.Invalid) return false;

  // First move of the game or after everyone passed
  if (!lastCards || lastType === HandType.Pass || !lastType) return true;

  // Rocket beats everything
  if (currentHand.type === HandType.Rocket) return true;

  // Bomb beats everything except Rocket or higher Bomb
  if (currentHand.type === HandType.Bomb) {
    if (lastType !== HandType.Bomb && lastType !== HandType.Rocket) return true;
    if (lastType === HandType.Bomb && currentHand.value > lastValue) return true;
    return false;
  }

  // Otherwise, types must match and length must match (mostly) and value must be higher
  if (currentHand.type !== lastType) return false;
  if (currentCards.length !== lastCards.length) return false;
  
  return currentHand.value > lastValue;
};

// Basic greedy bot logic
export const findMove = (hand: Card[], lastCards: Card[] | null): Card[] | null => {
  const sortedHand = sortCards(hand);
  
  // If free turn (start or everyone passed), play smallest single to get rid of cards
  if (!lastCards || lastCards.length === 0) {
    // Try to play a straight or triple first? Too complex for basic AI. 
    // Just play lowest single.
    return [sortedHand[sortedHand.length - 1]]; 
  }

  const lastHandInfo = determineHandType(lastCards);
  
  // Try to find a valid response
  // 1. Check for Rocket
  const jokers = sortedHand.filter(c => c.value >= 20);
  if (jokers.length === 2 && lastHandInfo.type !== HandType.Rocket) {
    // Only play rocket if really needed or last resort? 
    // AI: Hold rocket for end? No, let's win if we can. 
    // Simple AI: Don't waste rocket on a 3. 
  }

  // 2. Simple response search (Singles, Pairs, Triples)
  // This is a simplified search. A real engine would generate all subsets.
  
  if (lastHandInfo.type === HandType.Single) {
    for (let i = sortedHand.length - 1; i >= 0; i--) {
       if (sortedHand[i].value > lastHandInfo.value) return [sortedHand[i]];
    }
  }

  if (lastHandInfo.type === HandType.Pair) {
    // Find pair
    for (let i = sortedHand.length - 1; i > 0; i--) {
      if (sortedHand[i].value === sortedHand[i-1].value && sortedHand[i].value > lastHandInfo.value) {
        return [sortedHand[i-1], sortedHand[i]];
      }
    }
  }
  
  // Pass if no simple beat found
  return null;
}