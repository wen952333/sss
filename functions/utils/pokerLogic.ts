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
    // UPDATED: Spades > Hearts > Clubs > Diamonds
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
    isWheel?: boolean; // A-2-3-4-5
    topCard?: Card;
    cards?: Card[];
}

export const analyze5 = (cards: Card[]): AnalyzedHand => {
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

const getStraightEffectiveValue = (h: AnalyzedHand): number => {
    // 10-J-Q-K-A (14,13,12,11,10) -> Max Rank 14.
    // A-2-3-4-5 -> Second Largest. Let's give it 13.5
    // K-Q-J-10-9 (13...) -> 13
    if (h.isWheel) return 13.5; 
    if (h.values && h.values.length > 0) return h.values[0];
    return 0;
};

export const compareAnalyzed = (h1: AnalyzedHand, h2: AnalyzedHand): number => {
  if (h1.type !== h2.type) return h1.type - h2.type;

  // Straight / SF Logic
  if (h1.type === HandType.STRAIGHT || h1.type === HandType.STRAIGHT_FLUSH) {
      const v1 = getStraightEffectiveValue(h1);
      const v2 = getStraightEffectiveValue(h2);
      
      // Rank Category Priority
      if (v1 !== v2) return v1 - v2;
      
      // Tie-breaker: Suit of top card
      // Note: For Wheel (A-2-3-4-5), Ace is the "Top Card" for suit comparison usually.
      // analyze5 sorts cards descending, so sorted[0] is Ace.
      const s1 = getSuitValue(h1.topCard!.suit);
      const s2 = getSuitValue(h2.topCard!.suit);
      return s1 - s2;
  }

  // Flush Logic
  if (h1.type === HandType.FLUSH) {
      // 1. Compare Ranks first (Lexicographical)
      for (let i = 0; i < h1.values.length; i++) {
        if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
      }
      // 2. If ranks identical (impossible in 1 deck), compare Suit of top card
      const s1 = getSuitValue(h1.cards![0].suit);
      const s2 = getSuitValue(h2.cards![0].suit);
      return s1 - s2;
  }

  // General Logic (Quads, Full House, Trips, Pairs, High Card)
  // Compare values (Rank)
  for (let i = 0; i < h1.values.length; i++) {
    if (h1.values[i] !== h2.values[i]) return h1.values[i] - h2.values[i];
  }
  
  // Tie-breaker: Suit of top card
  // (Standard practice for Equal Pairs or Equal High Cards)
  if (h1.topCard && h2.topCard) {
      return getSuitValue(h1.topCard.suit) - getSuitValue(h2.topCard.suit);
  }

  return 0;
};

export enum SpecialHandType {
  NONE = 0,
  LIU_DUI_BAN = 3,         
  SAN_SHUN = 6,            
  SAN_HUA = 6.1,           
  LIU_DUI_ONE_QUAD = 14,   
  SAN_SHUN_ONE_SF = 16,    
  SAN_HUA_ONE_SF = 16.1,   
  DRAGON = 26,             
  LIU_DUI_TWO_QUADS = 30,  
  SAN_SHUN_TWO_SF = 36,    
  SAN_HUA_TWO_SF = 36.1    
}

export const checkSpecialHand = (hand: PlayerHand): { type: SpecialHandType, water: number, name: string } | null => {
  const allCards = [...hand.top, ...hand.middle, ...hand.bottom];
  const sorted = sortCards(allCards);
  const ranks = sorted.map(c => c.rank);
  const uniqueRanks = new Set(ranks);
  
  const midA = analyze5(hand.middle);
  const botA = analyze5(hand.bottom);

  if (uniqueRanks.size === 13) {
      return { type: SpecialHandType.DRAGON, water: 26, name: '至尊清龙' };
  }

  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const quads = Object.values(counts).filter(c => c === 4).length;
  let pairCount = 0;
  Object.values(counts).forEach(c => pairCount += Math.floor(c / 2));

  if (pairCount === 6) {
      if (quads === 2) return { type: SpecialHandType.LIU_DUI_TWO_QUADS, water: 30, name: '六对半(双四条)' };
      if (quads === 1) return { type: SpecialHandType.LIU_DUI_ONE_QUAD, water: 14, name: '六对半(带四条)' };
      return { type: SpecialHandType.LIU_DUI_BAN, water: 3, name: '六对半' };
  }

  const isTopFlush = hand.top.every(c => c.suit === hand.top[0].suit);
  const isMidFlush = midA.type === HandType.FLUSH || midA.type === HandType.STRAIGHT_FLUSH;
  const isBotFlush = botA.type === HandType.FLUSH || botA.type === HandType.STRAIGHT_FLUSH;

  if (isTopFlush && isMidFlush && isBotFlush) {
      let sfCount = 0;
      if (midA.type === HandType.STRAIGHT_FLUSH) sfCount++;
      if (botA.type === HandType.STRAIGHT_FLUSH) sfCount++;
      
      if (sfCount === 2) return { type: SpecialHandType.SAN_HUA_TWO_SF, water: 36, name: '三同花(双同花顺)' };
      if (sfCount === 1) return { type: SpecialHandType.SAN_HUA_ONE_SF, water: 16, name: '三同花(带同花顺)' };
      return { type: SpecialHandType.SAN_HUA, water: 6, name: '三同花' };
  }

  const topRanks = hand.top.map(c => c.rank).sort((a,b) => a-b);
  const isTopStraight = (topRanks[1] - topRanks[0] === 1 && topRanks[2] - topRanks[1] === 1) || (topRanks[0]===2 && topRanks[1]===3 && topRanks[2]===14);
  const isMidStraight = midA.type === HandType.STRAIGHT || midA.type === HandType.STRAIGHT_FLUSH;
  const isBotStraight = botA.type === HandType.STRAIGHT || botA.type === HandType.STRAIGHT_FLUSH;

  if (isTopStraight && isMidStraight && isBotStraight) {
      let sfCount = 0;
      if (midA.type === HandType.STRAIGHT_FLUSH) sfCount++;
      if (botA.type === HandType.STRAIGHT_FLUSH) sfCount++;

      if (sfCount === 2) return { type: SpecialHandType.SAN_SHUN_TWO_SF, water: 36, name: '三顺子(双同花顺)' };
      if (sfCount === 1) return { type: SpecialHandType.SAN_SHUN_ONE_SF, water: 16, name: '三顺子(带同花顺)' };
      return { type: SpecialHandType.SAN_SHUN, water: 6, name: '三顺子' };
  }

  return null;
};

const getLaneWaterValue = (analyzed: { type: HandType, values: number[] }, segment: 'top'|'mid'|'bot'): number => {
    if (segment === 'top') {
        if (analyzed.type === HandType.THREE_OF_A_KIND) return 3;
        return 1;
    } 
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

export const calculateTableScores = (
    submissions: { playerId: string, hand: PlayerHand, name: string }[]
): Record<string, number> => {
    
    const count = submissions.length;
    const finalScores: Record<string, number> = {};
    submissions.forEach(s => finalScores[s.playerId] = 0);

    const specialResults = submissions.map(s => ({ ...s, special: checkSpecialHand(s.hand) }));
    const matchResults: { p1: string, p2: string, water: number, isShoot: boolean }[] = [];
    
    for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
            const p1 = specialResults[i];
            const p2 = specialResults[j];

            if (p1.special || p2.special) {
                let w = 0;
                if (p1.special && p2.special) w = p1.special.water - p2.special.water;
                else if (p1.special) w = p1.special.water;
                else w = -p2.special?.water!;
                
                finalScores[p1.playerId] += w * 2;
                finalScores[p2.playerId] -= w * 2;
            } else {
                const p1Top = analyze3(p1.hand.top); const p2Top = analyze3(p2.hand.top);
                const p1Mid = analyze5(p1.hand.middle); const p2Mid = analyze5(p2.hand.middle);
                const p1Bot = analyze5(p1.hand.bottom); const p2Bot = analyze5(p2.hand.bottom);

                let w = 0;
                let p1Wins = 0;
                let p2Wins = 0;

                const rT = compareAnalyzed(p1Top, p2Top);
                if (rT > 0) { w += getLaneWaterValue(p1Top, 'top'); p1Wins++; }
                else if (rT < 0) { w -= getLaneWaterValue(p2Top, 'top'); p2Wins++; }

                const rM = compareAnalyzed(p1Mid, p2Mid);
                if (rM > 0) { w += getLaneWaterValue(p1Mid, 'mid'); p1Wins++; }
                else if (rM < 0) { w -= getLaneWaterValue(p2Mid, 'mid'); p2Wins++; }

                const rB = compareAnalyzed(p1Bot, p2Bot);
                if (rB > 0) { w += getLaneWaterValue(p1Bot, 'bot'); p1Wins++; }
                else if (rB < 0) { w -= getLaneWaterValue(p2Bot, 'bot'); p2Wins++; }

                let isShoot = false;
                if (p1Wins === 3) { w *= 2; isShoot = true; }
                if (p2Wins === 3) { w *= 2; isShoot = true; }

                matchResults.push({ p1: p1.playerId, p2: p2.playerId, water: w, isShoot });
            }
        }
    }

    const players = submissions.map(s => s.playerId);
    const shooterCounts: Record<string, number> = {};
    players.forEach(p => shooterCounts[p] = 0);

    matchResults.forEach(m => {
        if (m.isShoot) {
            if (m.water > 0) shooterCounts[m.p1]++;
            else shooterCounts[m.p2]++;
        }
    });

    const activePlayers = submissions.length;
    const homeRunPlayer = Object.keys(shooterCounts).find(pid => shooterCounts[pid] === activePlayers - 1);

    matchResults.forEach(m => {
        let finalWater = m.water;
        if (homeRunPlayer) {
            if (m.p1 === homeRunPlayer && m.water > 0) finalWater *= 2;
            else if (m.p2 === homeRunPlayer && m.water < 0) finalWater *= 2;
        }

        finalScores[m.p1] += finalWater * 2;
        finalScores[m.p2] -= finalWater * 2;
    });

    return finalScores;
};