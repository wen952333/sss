
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

const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    });
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const getRankValue = (r: Rank): number => r;
const getSuitValue = (s: Suit): number => {
    switch (s) {
      case 'spades': return 4;
      case 'hearts': return 3;
      case 'clubs': return 2;
      case 'diamonds': return 1;
    }
    return 0;
};

const sortCards = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

interface AnalyzedHand {
    type: HandType;
    values: number[];
    isWheel?: boolean; 
    topCard?: Card;
    cards?: Card[];
}

// --- Analysis Logic ---

export const analyze5 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  const isFlush = cards.every(c => c.suit === cards[0].suit);
  
  let isStraight = true;
  let isWheel = false;

  for (let i = 0; i < 4; i++) {
    if (ranks[i] - ranks[i+1] !== 1) {
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
  const topCard = sorted[0];
  const resultBase = { values: uniqueRanks, isWheel, topCard, cards: sorted };

  if (isStraight && isFlush) return { type: HandType.STRAIGHT_FLUSH, ...resultBase, values: ranks };
  if (countValues.includes(4)) return { type: HandType.FOUR_OF_A_KIND, ...resultBase };
  if (countValues.includes(3) && countValues.includes(2)) return { type: HandType.FULL_HOUSE, ...resultBase };
  if (isFlush) return { type: HandType.FLUSH, ...resultBase, values: ranks };
  if (isStraight) return { type: HandType.STRAIGHT, ...resultBase, values: ranks }; 
  if (countValues.includes(3)) return { type: HandType.THREE_OF_A_KIND, ...resultBase };
  if (countValues.filter(x => x === 2).length === 2) return { type: HandType.TWO_PAIRS, ...resultBase };
  if (countValues.includes(2)) return { type: HandType.ONE_PAIR, ...resultBase };
  
  return { type: HandType.HIGH_CARD, ...resultBase, values: ranks };
};

export const analyze3 = (cards: Card[]): AnalyzedHand => {
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => getRankValue(c.rank));
  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => counts[b] - counts[a] || b - a);
  const countValues = Object.values(counts);
  const topCard = sorted[0];
  const resultBase = { values: uniqueRanks, topCard, cards: sorted };

  if (countValues.includes(3)) return { type: HandType.THREE_OF_A_KIND, ...resultBase };
  if (countValues.includes(2)) return { type: HandType.ONE_PAIR, ...resultBase };
  return { type: HandType.HIGH_CARD, ...resultBase, values: ranks };
};

export const compareAnalyzed = (h1: AnalyzedHand, h2: AnalyzedHand): number => {
  if (h1.type !== h2.type) return h1.type - h2.type;
  if (h1.type === HandType.STRAIGHT || h1.type === HandType.STRAIGHT_FLUSH) {
      return (h1.values[0] || 0) - (h2.values[0] || 0);
  }
  for (let i = 0; i < h1.values.length; i++) {
    if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
  }
  return 0;
};

// --- Scoring Logic (Water Calculation) ---

const getLaneWaterValue = (analyzed: AnalyzedHand, segment: 'top'|'mid'|'bot'): number => {
    if (segment === 'top') return analyzed.type === HandType.THREE_OF_A_KIND ? 3 : 1;
    if (segment === 'mid') {
        if (analyzed.type === HandType.FULL_HOUSE) return 2;
        if (analyzed.type === HandType.FOUR_OF_A_KIND) return 8;
        if (analyzed.type === HandType.STRAIGHT_FLUSH) return 10;
        return 1;
    }
    if (segment === 'bot') {
        if (analyzed.type === HandType.FOUR_OF_A_KIND) return 4;
        if (analyzed.type === HandType.STRAIGHT_FLUSH) return 5;
        return 1;
    }
    return 1;
};

export const calculateTableScores = (submissions: { playerId: string, hand: PlayerHand }[]): Record<string, number> => {
    const scores: Record<string, number> = {};
    submissions.forEach(s => scores[s.playerId] = 0);

    // Analyze all hands once
    const analyzed = submissions.map(s => ({
        pid: s.playerId,
        top: analyze3(s.hand.top),
        mid: analyze5(s.hand.middle),
        bot: analyze5(s.hand.bottom)
    }));

    // Compare every pair (supports 2, 3, or 4 players)
    for (let i = 0; i < analyzed.length; i++) {
        for (let j = i + 1; j < analyzed.length; j++) {
            const p1 = analyzed[i];
            const p2 = analyzed[j];
            
            let p1Wins = 0;
            let p2Wins = 0;
            let money = 0;

            // Top
            let diff = compareAnalyzed(p1.top, p2.top);
            if (diff > 0) { money += getLaneWaterValue(p1.top, 'top'); p1Wins++; }
            else if (diff < 0) { money -= getLaneWaterValue(p2.top, 'top'); p2Wins++; }

            // Mid
            diff = compareAnalyzed(p1.mid, p2.mid);
            if (diff > 0) { money += getLaneWaterValue(p1.mid, 'mid'); p1Wins++; }
            else if (diff < 0) { money -= getLaneWaterValue(p2.mid, 'mid'); p2Wins++; }

            // Bot
            diff = compareAnalyzed(p1.bot, p2.bot);
            if (diff > 0) { money += getLaneWaterValue(p1.bot, 'bot'); p1Wins++; }
            else if (diff < 0) { money -= getLaneWaterValue(p2.bot, 'bot'); p2Wins++; }

            // Shoot (All 3 lanes win)
            if (p1Wins === 3) money *= 2;
            if (p2Wins === 3) money *= 2; // money is negative, so *2 makes it more negative

            scores[p1.pid] += money;
            scores[p2.pid] -= money;
        }
    }
    return scores;
};

// --- Solver ---

function* combinations<T>(elements: T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return; }
  for (let i = 0; i <= elements.length - k; i++) {
    const first = elements[i];
    for (const rest of combinations(elements.slice(i + 1), k - 1)) {
      yield [first, ...rest];
    }
  }
}

export const autoArrangeHand = (cards: Card[]): PlayerHand => {
    // Simplified Solver for Backend Auto-Play
    let bestBot: { hand: AnalyzedHand, remaining: Card[] } | null = null;
    
    // 1. Find Best Bottom
    const iter5 = combinations(cards, 5);
    for (const combo of iter5) {
        const analyzed = analyze5(combo);
        if (!bestBot || compareAnalyzed(analyzed, bestBot.hand) > 0) {
            const ids = new Set(combo.map(c => c.id));
            bestBot = { hand: analyzed, remaining: cards.filter(c => !ids.has(c.id)) };
        }
    }

    if (!bestBot) {
        const s = sortCards(cards);
        return { top: s.slice(10,13), middle: s.slice(5,10), bottom: s.slice(0,5) };
    }

    // 2. Find Best Middle
    let bestMid: { hand: AnalyzedHand, remaining: Card[] } | null = null;
    const iterMid = combinations(bestBot.remaining, 5);
    for (const combo of iterMid) {
        const analyzed = analyze5(combo);
        if (compareAnalyzed(analyzed, bestBot.hand) > 0) continue; 

        if (!bestMid || compareAnalyzed(analyzed, bestMid.hand) > 0) {
            const ids = new Set(combo.map(c => c.id));
            bestMid = { hand: analyzed, remaining: bestBot.remaining.filter(c => !ids.has(c.id)) };
        }
    }

    if (!bestMid) {
         const s = sortCards(bestBot.remaining);
         return { bottom: bestBot.hand.cards!, middle: s.slice(0,5), top: s.slice(5,8) };
    }

    const topCards = bestMid.remaining;
    return {
        bottom: bestBot.hand.cards!,
        middle: bestMid.hand.cards!,
        top: topCards
    };
};
