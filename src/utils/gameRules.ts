
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
  const possible = findPossibleMoves(hand, lastCards);
  return possible.length > 0 ? possible[0] : null;
}

// 核心逻辑：寻找所有可能的出牌组合（用于“建议”功能）
export const findPossibleMoves = (hand: Card[], lastCards: Card[] | null): Card[][] => {
  const sortedHand = sortCards(hand);
  const moves: Card[][] = [];

  // Group cards by value
  const groups: { [value: number]: Card[] } = {};
  sortedHand.forEach(c => {
    if (!groups[c.value]) groups[c.value] = [];
    groups[c.value].push(c);
  });
  
  const values = Object.keys(groups).map(Number).sort((a, b) => a - b);

  // Helper to find Rocket
  const findRocket = () => {
    const jokers = sortedHand.filter(c => c.value >= 20);
    if (jokers.length === 2) moves.push(jokers);
  };
  
  // Helper to find Bombs
  const findBombs = (minValue: number = 0) => {
    values.forEach(v => {
      if (v > minValue && groups[v].length === 4) {
        moves.push(groups[v]);
      }
    });
  };

  // If leading (free play), suggest smallest single, pair, or triple
  if (!lastCards || lastCards.length === 0) {
    // Return all valid minimal moves (one of each type available)
    // 1. Smallest Single
    moves.push([sortedHand[sortedHand.length - 1]]);
    
    // 2. Smallest Pair
    for (let v of values) {
      if (groups[v].length >= 2) {
        moves.push(groups[v].slice(0, 2));
        break;
      }
    }
    
    // 3. Smallest Triple
    for (let v of values) {
        if (groups[v].length >= 3) {
            moves.push(groups[v].slice(0, 3));
            break;
        }
    }
    // 如果啥都没有，就单出
    if (moves.length === 0 && sortedHand.length > 0) {
        moves.push([sortedHand[sortedHand.length - 1]]);
    }
    return moves;
  }

  const lastHandInfo = determineHandType(lastCards);
  const lastValue = lastHandInfo.value;

  // Always check for Rocket if last wasn't Rocket
  if (lastHandInfo.type !== HandType.Rocket) {
    findRocket();
  }

  // Check for Bombs (if last wasn't Rocket, and if last was Bomb, must be bigger)
  if (lastHandInfo.type !== HandType.Rocket) {
    const minBombValue = lastHandInfo.type === HandType.Bomb ? lastValue : 0;
    findBombs(minBombValue);
  }

  // Type specific search
  switch (lastHandInfo.type) {
    case HandType.Single:
      values.forEach(v => {
        if (v > lastValue) moves.push([groups[v][0]]);
      });
      break;

    case HandType.Pair:
      values.forEach(v => {
        if (v > lastValue && groups[v].length >= 2) moves.push(groups[v].slice(0, 2));
      });
      break;

    case HandType.Triple:
      values.forEach(v => {
        if (v > lastValue && groups[v].length >= 3) moves.push(groups[v].slice(0, 3));
      });
      break;
      
    case HandType.TripleWithOne:
       values.forEach(v => {
           if (v > lastValue && groups[v].length >= 3) {
               // Find a kicker (single)
               const triple = groups[v].slice(0, 3);
               // Simple strategy: pick smallest single that is not part of this triple
               for (let k of values) {
                   if (k !== v) {
                       moves.push([...triple, groups[k][0]]);
                       // Just finding one variation per triple is enough for UX usually
                       break; 
                   }
               }
           }
       });
       break;

     case HandType.TripleWithPair:
        values.forEach(v => {
            if (v > lastValue && groups[v].length >= 3) {
                const triple = groups[v].slice(0, 3);
                for (let k of values) {
                    if (k !== v && groups[k].length >= 2) {
                        moves.push([...triple, ...groups[k].slice(0, 2)]);
                        break;
                    }
                }
            }
        });
        break;

      // TODO: Implement Straight logic for full completeness
      // For now, simplify to basic types
  }

  return moves;
};
