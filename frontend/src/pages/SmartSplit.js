// ================== 核心常量与配置 ==================
const SPLIT_ENUM_LIMIT = 2800; // 提高枚举上限
const TOP_N_HEAD = 15;         // 增加头道候选
const TOP_N_TAIL = 20;         // 增加尾道候选
const SPECIAL_TYPE_BONUS = 150; // 提高特殊牌型奖励
const CONNECTION_BONUS = 30;   // 提高连接性奖励
const PATTERN_BONUS = 40;      // 新增牌型模式奖励

const TYPE_WEIGHTS = {
  'head': { '三条': 50, '对子': 20, '高牌': -15 },
  'middle': {
    '同花顺': 45, '铁支': 50, '葫芦': 35, '顺子': 20, '同花': 15,
    '三条': 12, '两对': 8, '对子': -5, '高牌': -12
  },
  'tail': { '铁支': 75, '同花顺': 65, '葫芦': 40, '顺子': 25 }
};

const PATTERN_MAP = {
  'AAA': { head: '三条', middle: '同花顺', tail: '铁支' },
  'BBB': { head: '对子', middle: '葫芦', tail: '同花顺' },
  'CCC': { head: '高牌', middle: '顺子', tail: '葫芦' }
};

const TYPE_CONNECTIONS = {
  '对子': ['两对', '葫芦'],
  '三条': ['葫芦'],
  '顺子': ['同花顺'],
  '同花': ['同花顺'],
  '两对': ['葫芦']
};

const SPECIAL_TYPE_WEIGHTS = {
  '三同花': 1200,
  '三顺子': 1100,
  '一条龙': 1300,
  '六对半': 900,
  '全大': 800,
  '全小': 750,
  '三同花顺': 1500
};

// ================== 主接口 ==================
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 增强特殊牌型检测
  const specialSplit = detectSpecialTypeSplit(cards13);
  if (specialSplit) return [specialSplit];

  const typeCache = new Map();
  let allHead = enhancedHeadCombinations(cards13, typeCache).slice(0, TOP_N_HEAD);
  let splits = [];
  let tries = 0;

  for (const { head, headScore } of allHead) {
    const left10 = cards13.filter(c => !head.includes(c));
    const midCandidates = prefilterMiddle(left10, head, typeCache);
    for (const mid of midCandidates) {
      const tail = left10.filter(c => !mid.includes(c));
      if (tail.length !== 5) continue;
      tries++;
      if (tries > SPLIT_ENUM_LIMIT) break;

      const midType = getCachedHandType(mid, 'middle', typeCache);
      const headType = getCachedHandType(head, 'head', typeCache);
      const tailType = getCachedHandType(tail, 'tail', typeCache);

      if (isFoulEnhanced(head, mid, tail, headType, midType, tailType)) continue;

      const score = enhancedScoreSplit(
        head, mid, tail,
        headType, midType, tailType,
        headScore, evalTail(tail)
      );

      splits.push({ head, middle: mid, tail, score });
    }
    if (tries > SPLIT_ENUM_LIMIT) break;
  }

  if (!splits.length) splits = fallbackStrategy(cards13, typeCache);
  if (!splits.length) return [balancedSplit(cards13)];

  const topSplits = splits.sort((a, b) => b.score - a.score);
  const resultCount = Math.max(1, Math.min(5, Math.floor(topSplits.length * 0.1)));
  return topSplits.slice(0, resultCount).map(s => ({
    head: s.head, middle: s.middle, tail: s.tail
  }));
}

export function aiSmartSplit(cards13) {
  const splits = getSmartSplits(cards13);
  return splits[0] || { head: cards13.slice(0, 3), middle: cards13.slice(3, 8), tail: cards13.slice(8, 13) };
}
export function fillAiPlayers(playersArr) {
  return playersArr.map(p =>
    p.isAI && Array.isArray(p.cards13) && p.cards13.length === 13
      ? { ...p, ...aiSmartSplit(p.cards13) }
      : p
  );
}
export function getPlayerSmartSplits(cards13) {
  return getSmartSplits(cards13);
}

// ================== 新增中道预筛选 ==================
function prefilterMiddle(cards, head, typeCache) {
  const candidates = [];
  const headType = handType(head, 'head');
  if (headType === '三条') {
    candidates.push(...findPotentialStraights(cards), ...findFlushes(cards));
  } else if (headType === '对子') {
    candidates.push(...findTwoPairs(cards), ...findFullHouses(cards));
  }
  if (candidates.length < 8) {
    const highCards = cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 5);
    candidates.push(highCards);
  }
  const seen = new Set();
  return candidates.filter(combo => {
    const key = combo.slice().sort().join(',');
    return !seen.has(key) && seen.add(key);
  }).slice(0, 12);
}

// ================== 增强功能实现 ==================
function enhancedHeadCombinations(cards, typeCache) {
  const heads = [], seen = new Set();
  const groups = groupCardsByValue(cards);
  const tripleValues = Object.keys(groups).filter(v => groups[v].length >= 3);
  tripleValues.sort((a, b) => cardValue(b) - cardValue(a));
  for (const value of tripleValues) {
    const combos = combinations(groups[value], 3);
    for (const combo of combos) {
      const key = combo.slice().sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        heads.push({
          head: combo,
          headScore: TYPE_WEIGHTS.head['三条'] + getTotalValue(combo) * 1.25
        });
      }
    }
  }
  const pairValues = Object.keys(groups).filter(v => groups[v].length >= 2);
  pairValues.sort((a, b) => cardValue(b) - cardValue(a));
  for (const value of pairValues) {
    const pairs = combinations(groups[value], 2);
    for (const pair of pairs) {
      const others = cards.filter(c => !pair.includes(c));
      if (others.length > 0) {
        const sortedOthers = [...others].sort((a, b) => cardValue(b) - cardValue(a));
        const headCombo = [...pair, sortedOthers[0]];
        const key = headCombo.slice().sort().join(',');
        if (!seen.has(key)) {
          seen.add(key);
          heads.push({
            head: headCombo,
            headScore: TYPE_WEIGHTS.head['对子'] + getTotalValue(headCombo) * 1.18
          });
        }
      }
    }
  }
  if (heads.length < TOP_N_HEAD) {
    const highCombo = cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 3);
    const key = highCombo.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      heads.push({
        head: highCombo,
        headScore: TYPE_WEIGHTS.head['高牌'] + getTotalValue(highCombo)
      });
    }
  }
  if (heads.length < TOP_N_HEAD) {
    const patternHeads = detectHeadPatterns(cards);
    for (const head of patternHeads) {
      const key = head.slice().sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        heads.push({
          head,
          headScore: TYPE_WEIGHTS.head[handType(head, 'head')] + getTotalValue(head) * 1.1
        });
      }
    }
  }
  return heads.sort((a, b) => b.headScore - a.headScore);
}

function enhancedTailCombinations(cards, typeCache) {
  const tails = [], seen = new Set();
  const straightFlushes = findStraightFlushes(cards);
  for (const sf of straightFlushes) {
    const isRoyal = sf.some(card => cardValue(card) === 14) && sf.some(card => cardValue(card) === 13);
    const key = sf.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      tails.push({
        tail: sf,
        tailScore: TYPE_WEIGHTS.tail['同花顺'] + getTotalValue(sf) * (isRoyal ? 2.0 : 1.85)
      });
    }
  }
  const groups = groupCardsByValue(cards);
  const fourKinds = Object.keys(groups)
    .filter(v => groups[v].length === 4)
    .sort((a, b) => cardValue(b) - cardValue(a));
  for (const value of fourKinds) {
    const combo = groups[value];
    const key = combo.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      tails.push({
        tail: combo,
        tailScore: TYPE_WEIGHTS.tail['铁支'] + getTotalValue(combo) * 1.75
      });
    }
  }
  const fullHouses = findFullHouses(cards);
  fullHouses.sort((a, b) => Math.max(...b.map(cardValue)) - Math.max(...a.map(cardValue)));
  for (const fh of fullHouses) {
    const key = fh.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      tails.push({
        tail: fh,
        tailScore: TYPE_WEIGHTS.tail['葫芦'] + getTotalValue(fh) * 1.65
      });
    }
  }
  if (tails.length < TOP_N_TAIL) {
    const flushes = findFlushes(cards);
    for (const flush of flushes) {
      const key = flush.slice().sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        tails.push({
          tail: flush,
          tailScore: (TYPE_WEIGHTS.tail['同花'] || 0) + getTotalValue(flush) * 1.5
        });
      }
    }
    const straights = findPotentialStraights(cards);
    for (const straight of straights) {
      const key = straight.slice().sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        tails.push({
          tail: straight,
          tailScore: (TYPE_WEIGHTS.tail['顺子'] || 0) + getTotalValue(straight) * 1.45
        });
      }
    }
    const highCombo = cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 5);
    const key = highCombo.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      const t = getCachedHandType(highCombo, 'tail', typeCache);
      tails.push({
        tail: highCombo,
        tailScore: (TYPE_WEIGHTS.tail[t] || 0) + getTotalValue(highCombo) * 1.4
      });
    }
  }
  return tails.sort((a, b) => b.tailScore - a.tailScore);
}

function isFoulEnhanced(head, middle, tail, headType, midType, tailType) {
  const headRank = handTypeRank(headType, 'head');
  const midRank = handTypeRank(midType, 'middle');
  const tailRank = handTypeRank(tailType, 'tail');
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  if (headRank === midRank && compareAreaEnhanced(head, middle, headType) > 0) return true;
  if (midRank === tailRank && compareAreaEnhanced(middle, tail, midType) > 0) return true;
  return false;
}

function compareAreaEnhanced(a, b, type) {
  const valueA = getHandStrength(a, type);
  const valueB = getHandStrength(b, type);
  return valueB - valueA;
}

function getHandStrength(cards, type) {
  const baseScore = handTypeScore(type) * 100;
  const cardValues = cards.map(cardValue).sort((a, b) => b - a);
  switch(type) {
    case '三条':
    case '铁支':
      const mainValue = mostCommonValue(cards);
      return baseScore + mainValue * 10 + cardValues.reduce((sum, v) => sum + v, 0);
    case '葫芦':
      const tripleValue = mostCommonValue(cards);
      const pairValue = secondCommonValue(cards);
      return baseScore + tripleValue * 10 + pairValue * 5;
    case '两对':
      const pairs = getPairValues(cards);
      return baseScore + Math.max(...pairs) * 10 + Math.min(...pairs) * 5 + cardValues[0];
    case '对子':
      const pairVal = mostCommonValue(cards);
      return baseScore + pairVal * 10 + cardValues.filter(v => v !== pairVal).reduce((sum, v) => sum + v, 0);
    case '同花顺':
    case '顺子':
      return baseScore + Math.max(...cardValues) * 10 + cardValues.reduce((sum, v) => sum + v, 0);
    default:
      return baseScore + cardValues.reduce((sum, v, i) => sum + v * Math.pow(0.9, i), 0);
  }
}

function enhancedScoreSplit(head, mid, tail, headType, midType, tailType, headScore, tailScore) {
  let score =
    handTypeScore(tailType) * 160 +
    handTypeScore(midType) * 30 +
    handTypeScore(headType) * 8;
  score += TYPE_WEIGHTS.head[headType] || 0;
  score += TYPE_WEIGHTS.middle[midType] || 0;
  score += TYPE_WEIGHTS.tail[tailType] || 0;
  score += getTotalValue(head) * 0.8 +
           getTotalValue(mid) * 1.1 +
           getTotalValue(tail) * 1.6;
  score += getConnectionBonus(headType, midType, tailType);
  if (isSpecialType(head, mid, tail)) score += SPECIAL_TYPE_BONUS;
  score += detectPatternBonus(headType, midType, tailType);
  if (isBreakingGoodHand(head, mid, tail, headType, midType, tailType)) score -= 45;
  if (hasTailPotential(tail)) score += 25;
  return score;
}

function hasTailPotential(tail) {
  const tailType = handType(tail, 'tail');
  if (['铁支', '同花顺', '葫芦'].includes(tailType)) return true;
  const suits = groupCardsBySuit(tail);
  if (Object.values(suits).some(g => g.length >= 4)) return true;
  const values = groupCardsByValue(tail);
  if (Object.values(values).some(g => g.length >= 3)) return true;
  return false;
}

function detectPatternBonus(headType, midType, tailType) {
  for (const pattern in PATTERN_MAP) {
    const { head, middle, tail } = PATTERN_MAP[pattern];
    if (headType === head && midType === middle && tailType === tail) {
      return PATTERN_BONUS;
    }
  }
  return 0;
}

function getConnectionBonus(headType, midType, tailType) {
  let bonus = 0;
  if (TYPE_CONNECTIONS[headType] && TYPE_CONNECTIONS[headType].includes(midType)) bonus += CONNECTION_BONUS;
  if (TYPE_CONNECTIONS[midType] && TYPE_CONNECTIONS[midType].includes(tailType)) bonus += CONNECTION_BONUS;
  if (['顺子', '同花'].includes(headType) && ['顺子', '同花'].includes(midType) && ['顺子', '同花'].includes(tailType)) bonus += CONNECTION_BONUS * 0.5;
  return bonus;
}

function fallbackStrategy(cards13, typeCache) {
  const splits = [];
  const groups = groupCardsByValue(cards13);
  let candidateHeads = [];
  for (const value in groups) {
    if (groups[value].length >= 3) candidateHeads.push(...combinations(groups[value], 3));
  }
  for (const value in groups) {
    if (groups[value].length >= 2) {
      const pairs = combinations(groups[value], 2);
      for (const pair of pairs) {
        const others = cards13.filter(c => !pair.includes(c));
        if (others.length > 0) {
          const bestThird = others.sort((a, b) => cardValue(b) - cardValue(a))[0];
          candidateHeads.push([...pair, bestThird]);
        }
      }
    }
  }
  candidateHeads.push(cards13.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 3));
  for (const head of candidateHeads.slice(0, 15)) {
    const left10 = cards13.filter(c => !head.includes(c));
    for (const tail of combinations(left10, 5)) {
      const middle = left10.filter(c => !tail.includes(c));
      const headType = getCachedHandType(head, 'head', typeCache);
      const midType = getCachedHandType(middle, 'middle', typeCache);
      const tailType = getCachedHandType(tail, 'tail', typeCache);
      if (isFoulEnhanced(head, middle, tail, headType, midType, tailType)) continue;
      const score = enhancedScoreSplit(
        head, middle, tail,
        headType, midType, tailType,
        evalHead(head), evalTail(tail)
      );
      splits.push({ head, middle, tail, score });
      if (splits.length >= 8) break;
    }
  }
  return splits;
}

// ================== 特殊牌型检测增强 ==================
function detectSpecialTypeSplit(cards13) {
  // 1. 三同花（增强检测）
  const suitGroups = groupCardsBySuit(cards13);
  const flushGroups = Object.values(suitGroups).filter(g => g.length >= 3);
  if (flushGroups.length >= 3) {
    flushGroups.sort((a, b) => b.length - a.length);
    const head = flushGroups[0].slice(0, 3);
    const tail = flushGroups[1].slice(0, 5);
    const mid = [];
    const used = new Set([...head, ...tail]);
    for (let i = 2; i < flushGroups.length; i++) {
      for (const card of flushGroups[i]) {
        if (mid.length < 5 && !used.has(card)) {
          mid.push(card);
          used.add(card);
        }
      }
    }
    if (mid.length < 5) {
      const remaining = cards13.filter(c => !used.has(c));
      remaining.sort((a, b) => cardValue(b) - cardValue(a));
      mid.push(...remaining.slice(0, 5 - mid.length));
    }
    if (head.length === 3 && mid.length === 5 && tail.length === 5) {
      const score = SPECIAL_TYPE_WEIGHTS['三同花'] + SPECIAL_TYPE_BONUS;
      return { head, middle: mid, tail, score };
    }
  }
  // 2. 三顺子（增强检测）
  const straights = findPotentialStraights(cards13);
  if (straights.length >= 3) {
    straights.sort((a, b) => b.length - a.length);
    for (let i = 0; i < straights.length - 2; i++) {
      for (let j = i + 1; j < straights.length - 1; j++) {
        for (let k = j + 1; k < straights.length; k++) {
          const head = straights[i].slice(0, 3);
          const mid = straights[j].slice(0, 5);
          const tail = straights[k].slice(0, 5);
          const allCards = [...head, ...mid, ...tail];
          if (new Set(allCards).size === 13) {
            const score = SPECIAL_TYPE_WEIGHTS['三顺子'] + SPECIAL_TYPE_BONUS;
            return { head, middle: mid, tail, score };
          }
        }
      }
    }
  }
  // 3. 一条龙（增强检测）
  const uniqueValues = new Set(cards13.map(cardValue));
  if (uniqueValues.size === 13) {
    const sorted = cards13.slice().sort((a, b) => cardValue(a) - cardValue(b));
    const head = sorted.slice(0, 3);
    const mid = sorted.slice(3, 8);
    const tail = sorted.slice(8, 13);
    const score = SPECIAL_TYPE_WEIGHTS['一条龙'] + SPECIAL_TYPE_BONUS;
    return { head, middle: mid, tail, score };
  }
  // 4. 六对半检测
  const sixPairs = detectSixPairs(cards13);
  if (sixPairs) {
    return {
      head: sixPairs.head,
      middle: sixPairs.middle,
      tail: sixPairs.tail,
      score: SPECIAL_TYPE_WEIGHTS['六对半'] + SPECIAL_TYPE_BONUS
    };
  }
  // 5. 全大/全小检测
  const allBig = cards13.every(card => cardValue(card) >= 10);
  const allSmall = cards13.every(card => cardValue(card) <= 8);
  if (allBig) {
    const sorted = cards13.sort((a, b) => cardValue(b) - cardValue(a));
    return {
      head: sorted.slice(0, 3),
      middle: sorted.slice(3, 8),
      tail: sorted.slice(8, 13),
      score: SPECIAL_TYPE_WEIGHTS['全大'] + SPECIAL_TYPE_BONUS
    };
  }
  if (allSmall) {
    const sorted = cards13.sort((a, b) => cardValue(a) - cardValue(b));
    return {
      head: sorted.slice(0, 3),
      middle: sorted.slice(3, 8),
      tail: sorted.slice(8, 13),
      score: SPECIAL_TYPE_WEIGHTS['全小'] + SPECIAL_TYPE_BONUS
    };
  }
  // 6. 三同花顺检测
  const straightFlushGroups = detectStraightFlushGroups(cards13);
  if (straightFlushGroups.length >= 3) {
    straightFlushGroups.sort((a, b) => b.length - a.length);
    const head = straightFlushGroups[0].slice(0, 3);
    const tail = straightFlushGroups[1].slice(0, 5);
    const mid = straightFlushGroups[2].slice(0, 5);
    if (head.length === 3 && mid.length === 5 && tail.length === 5) {
      const score = SPECIAL_TYPE_WEIGHTS['三同花顺'] + SPECIAL_TYPE_BONUS;
      return { head, middle: mid, tail, score };
    }
  }
  return null;
}

function detectSixPairs(cards13) {
  const groups = groupCardsByValue(cards13);
  const pairs = [];
  for (const value in groups) {
    if (groups[value].length === 2) pairs.push(groups[value]);
  }
  if (pairs.length < 6) return null;
  pairs.sort((a, b) => cardValue(b[0]) - cardValue(a[0]));
  const sixPairs = pairs.slice(0, 6).flat();
  const remaining = cards13.filter(card => !sixPairs.includes(card));
  if (remaining.length !== 1) return null;
  return {
    head: [...pairs[0], pairs[1][0]],
    middle: [...pairs[2], ...pairs[3], ...remaining],
    tail: [...pairs[4], ...pairs[5]]
  };
}

function detectStraightFlushGroups(cards13) {
  const suitGroups = groupCardsBySuit(cards13);
  const straightFlushGroups = [];
  for (const suit in suitGroups) {
    const flushes = findStraightFlushes(suitGroups[suit]);
    if (flushes.length > 0) {
      const longest = flushes.sort((a, b) => b.length - a.length)[0];
      straightFlushGroups.push(longest);
    }
  }
  return straightFlushGroups;
}

function detectHeadPatterns(cards) {
  const patterns = [];
  const groups = groupCardsByValue(cards);
  const highPairs = Object.keys(groups)
    .filter(v => groups[v].length >= 2 && cardValue(v) >= 11)
    .sort((a, b) => cardValue(b) - cardValue(a));
  for (const value of highPairs.slice(0, 2)) {
    const pair = groups[value].slice(0, 2);
    const others = cards.filter(c => !pair.includes(c));
    if (others.length > 0) {
      const highOther = others.sort((a, b) => cardValue(b) - cardValue(a))[0];
      patterns.push([...pair, highOther]);
    }
  }
  const straights = findPotentialStraights(cards);
  for (const straight of straights) {
    if (straight.length >= 3) patterns.push(straight.slice(0, 3));
  }
  return patterns;
}

function findFlushes(cards) {
  const suitGroups = groupCardsBySuit(cards);
  const flushes = [];
  for (const suit in suitGroups) {
    if (suitGroups[suit].length >= 5) {
      const highCards = suitGroups[suit].sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 5);
      flushes.push(highCards);
    }
  }
  return flushes;
}

function findTwoPairs(cards) {
  const groups = groupCardsByValue(cards);
  const pairs = [];
  for (const value in groups) {
    if (groups[value].length >= 2) pairs.push(groups[value].slice(0, 2));
  }
  if (pairs.length < 2) return [];
  pairs.sort((a, b) => cardValue(b[0]) - cardValue(a[0]));
  const twoPairs = [];
  for (let i = 0; i < pairs.length - 1; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const pair1 = pairs[i], pair2 = pairs[j];
      const combined = [...pair1, ...pair2];
      const otherCards = cards.filter(c => !combined.includes(c));
      if (otherCards.length > 0) {
        const highCard = otherCards.sort((a, b) => cardValue(b) - cardValue(a))[0];
        twoPairs.push([...combined, highCard]);
      }
    }
  }
  return twoPairs;
}

function findPotentialStraights(cards) {
  const vals = cards.map(cardValue);
  const uniq = [...new Set(vals)].sort((a, b) => a - b);
  const straights = [];
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 1; j < 5; j++) if (uniq[i + j] !== uniq[i] + j) ok = false;
    if (ok) {
      const straightVals = uniq.slice(i, i + 5);
      const straightCards = cards.filter(c => straightVals.includes(cardValue(c)));
      if (straightCards.length >= 5) straights.push(straightCards.slice(0, 5));
    }
  }
  // A2345
  if (uniq.includes(14) && uniq.includes(2)) {
    const lowVals = [14, 2, 3, 4, 5];
    if (lowVals.every(v => uniq.includes(v))) {
      const straightCards = cards.filter(c => lowVals.includes(cardValue(c)));
      if (straightCards.length >= 5) straights.push(straightCards.slice(0, 5));
    }
  }
  return straights;
}

function findFullHouses(cards) {
  const groups = groupCardsByValue(cards);
  const triplets = [];
  const pairs = [];
  for (const v in groups) {
    if (groups[v].length >= 3) triplets.push(...combinations(groups[v], 3));
    if (groups[v].length >= 2) pairs.push(...combinations(groups[v], 2));
  }
  const fullHouses = [];
  for (const t of triplets) for (const p of pairs)
    if (t.every(c => !p.includes(c))) fullHouses.push([...t, ...p]);
  return fullHouses;
}

function findStraightFlushes(cards) {
  const suitGroups = groupCardsBySuit(cards);
  const straightFlushes = [];
  for (const suit in suitGroups) {
    if (suitGroups[suit].length >= 5) {
      const suitStraights = findPotentialStraights(suitGroups[suit]);
      straightFlushes.push(...suitStraights);
    }
  }
  return straightFlushes;
}

// ================== 辅助工具函数 ==================
function getCachedHandType(cards, area, cache) {
  const key = cards.slice().sort().join(',') + area;
  if (cache.has(key)) return cache.get(key);
  const type = handType(cards, area);
  cache.set(key, type);
  return type;
}
function groupCardsByValue(cards) {
  const groups = {};
  for (const card of cards) {
    const v = cardValue(card);
    if (!groups[v]) groups[v] = [];
    groups[v].push(card);
  }
  return groups;
}
function groupCardsBySuit(cards) {
  const groups = {};
  for (const card of cards) {
    const suit = cardSuit(card);
    if (!groups[suit]) groups[suit] = [];
    groups[suit].push(card);
  }
  return groups;
}
function cardValue(card) {
  if (typeof card === "number") return card;
  const v = card.split('_')[0];
  if (v === 'ace') return 14;
  if (v === 'king') return 13;
  if (v === 'queen') return 12;
  if (v === 'jack') return 11;
  return parseInt(v, 10);
}
function cardSuit(card) {
  return card.split('_')[2] || card.split('_')[1];
}
function getTotalValue(cards) {
  return cards.reduce((sum, card) => sum + cardValue(card), 0);
}
function combinations(arr, k) {
  let res = [];
  function comb(path, start) {
    if (path.length === k) return res.push([...path]);
    for (let i = start; i < arr.length; ++i) comb([...path, arr[i]], i + 1);
  }
  comb([], 0);
  return res;
}
function balancedSplit(cards) {
  const sorted = [...cards];
  return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) };
}
function handType(cards, area) {
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[2]);
  const uniqVals = [...new Set(vals)];
  const uniqSuits = [...new Set(suits)];
  if (cards.length === 5) {
    const groups = groupBy(vals);
    const groupCounts = Object.values(groups).map(g => g.length);
    if (groupCounts.some(count => count === 4)) return "铁支";
    if (uniqSuits.length === 1 && isStraight(vals)) return "同花顺";
    if (groupCounts.some(count => count === 3) && groupCounts.some(count => count === 2)) return "葫芦";
    if (uniqSuits.length === 1) return "同花";
    if (isStraight(vals)) return "顺子";
    if (groupCounts.some(count => count === 3)) return "三条";
    if (groupCounts.filter(count => count === 2).length === 2) return "两对";
    if (groupCounts.some(count => count === 2)) return "对子";
    return "高牌";
  }
  if (cards.length === 3) {
    if (uniqVals.length === 1) return "三条";
    const groups = groupBy(vals);
    const groupCounts = Object.values(groups).map(g => g.length);
    if (groupCounts.some(count => count === 2)) return "对子";
    return "高牌";
  }
  return "高牌";
}
function isStraight(vals) {
  const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];
  let idxs = vals.map(v => order.indexOf(v)).sort((a, b) => a - b);
  for (let i = 1; i < idxs.length; i++) if (idxs[i] !== idxs[i - 1] + 1) break;
  else if (i === idxs.length - 1) return true;
  if (idxs.includes(12) && idxs[0] === 0 && idxs[1] === 1) {
    const t = idxs.slice();
    t[t.indexOf(12)] = -1;
    t.sort((a, b) => a - b);
    for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1] + 1) return false;
    return true;
  }
  return false;
}
function groupBy(arr) {
  const g = {};
  arr.forEach(x => { g[x] = g[x] || []; g[x].push(x); });
  return g;
}
function evalHead(head) {
  const type = handType(head, 'head');
  let score = TYPE_WEIGHTS.head[type] || 0;
  score += getTotalValue(head) * (type === '三条' ? 1.2 : 1.15);
  return score;
}
function evalTail(tail) {
  const type = handType(tail, 'tail');
  let score = TYPE_WEIGHTS.tail[type] || 0;
  score += getTotalValue(tail) * (type === '同花顺' ? 1.8 : 1.6);
  return score;
}
function mostCommonValue(cards) {
  const groups = groupCardsByValue(cards);
  let maxCount = 0;
  let maxValue = 0;
  for (const value in groups) {
    if (groups[value].length > maxCount) {
      maxCount = groups[value].length;
      maxValue = cardValue(value);
    }
  }
  return maxValue;
}
function secondCommonValue(cards) {
  const groups = groupCardsByValue(cards);
  let values = [];
  for (const value in groups) {
    values.push({
      value: cardValue(value),
      count: groups[value].length
    });
  }
  values.sort((a, b) => b.count - a.count || b.value - a.value);
  return values.length > 1 ? values[1].value : 0;
}
function getPairValues(cards) {
  const groups = groupCardsByValue(cards);
  const pairValues = [];
  for (const value in groups) {
    if (groups[value].length >= 2) {
      pairValues.push(cardValue(value));
    }
  }
  return pairValues.sort((a, b) => b - a);
}
function isSpecialType(head, mid, tail) {
  const all = [...head, ...mid, ...tail];
  const uniqueValues = new Set(all.map(cardValue));
  if (uniqueValues.size === 13) return true;
  const headSuit = new Set(head.map(cardSuit));
  const midSuit = new Set(mid.map(cardSuit));
  const tailSuit = new Set(tail.map(cardSuit));
  if (headSuit.size === 1 && midSuit.size === 1 && tailSuit.size === 1) return true;
  const headIsStraight = isStraight(head.map(cardValue));
  const midIsStraight = isStraight(mid.map(cardValue));
  const tailIsStraight = isStraight(tail.map(cardValue));
  if (headIsStraight && midIsStraight && tailIsStraight) return true;
  return false;
}
function isBreakingGoodHand(head, mid, tail, headType, midType, tailType) {
  const allCards = [...head, ...mid, ...tail];
  const suitGroups = groupCardsBySuit(allCards);
  for (const suit in suitGroups) {
    if (suitGroups[suit].length >= 5) {
      const inHead = head.filter(c => cardSuit(c) === suit).length;
      const inMid = mid.filter(c => cardSuit(c) === suit).length;
      const inTail = tail.filter(c => cardSuit(c) === suit).length;
      if ([inHead, inMid, inTail].filter(cnt => cnt > 0).length > 1) return true;
    }
  }
  const vals = allCards.map(cardValue);
  const uniqueVals = [...new Set(vals)].sort((a, b) => a - b);
  let maxStreak = 0, currentStreak = 1;
  for (let i = 1; i < uniqueVals.length; i++) {
    if (uniqueVals[i] === uniqueVals[i - 1] + 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }
  if (maxStreak >= 6) {
    const startVal = uniqueVals.find((val, idx) => {
      let streak = 1;
      for (let i = 1; i < maxStreak; i++) {
        if (uniqueVals[idx + i] === val + i) streak++;
        else break;
      }
      return streak === maxStreak;
    });
    const sequenceCards = allCards.filter(card => {
      const val = cardValue(card);
      return val >= startVal && val <= startVal + maxStreak - 1;
    });
    const inHead = head.filter(c => sequenceCards.includes(c)).length;
    const inMid = mid.filter(c => sequenceCards.includes(c)).length;
    const inTail = tail.filter(c => sequenceCards.includes(c)).length;
    if ([inHead, inMid, inTail].filter(count => count > 0).length > 1) return true;
  }
  return false;
}
