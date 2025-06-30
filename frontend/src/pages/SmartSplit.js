// ================== 核心常量与配置 ==================
const SPLIT_ENUM_LIMIT = 2500;  // 总递归枚举上限提升
const TOP_N_HEAD = 12;          // 头道候选增加
const TOP_N_TAIL = 15;          // 尾道候选增加
const SPECIAL_TYPE_BONUS = 120; // 特殊牌型奖励提高

// 牌型权重系数（增强版）
const TYPE_WEIGHTS = {
  'head': {
    '三条': 45,
    '对子': 15,
    '高牌': -18
  },
  'middle': {
    '同花顺': 38,
    '铁支': 45,
    '葫芦': 28,
    '顺子': 15,
    '同花': 12,
    '三条': 10,
    '两对': 5,
    '对子': -8,
    '高牌': -15
  },
  'tail': {
    '铁支': 65,
    '同花顺': 55,
    '葫芦': 32,
    '顺子': 18
  }
};

// ================== 核心增强函数 ==================
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) return [];
  
  // 预检测特殊牌型
  const specialSplit = detectSpecialTypeSplit(cards13);
  if (specialSplit) return [specialSplit];
  
  // 缓存牌型计算结果
  const typeCache = new Map();
  
  // 步骤1：增强头道候选生成策略
  let allHead = enhancedHeadCombinations(cards13, typeCache)
    .slice(0, TOP_N_HEAD);

  // 步骤2：对每个头道，枚举所有合法尾道组合
  let splits = [];
  let tries = 0;
  
  for (const { head, headScore } of allHead) {
    const left10 = cards13.filter(c => !head.includes(c));
    
    // 增强尾道候选生成
    let allTail = enhancedTailCombinations(left10, typeCache)
      .slice(0, TOP_N_TAIL);

    for (const { tail, tailScore } of allTail) {
      const middle = left10.filter(c => !tail.includes(c));
      if (middle.length !== 5) continue;
      
      tries++;
      if (tries > SPLIT_ENUM_LIMIT) break;
      
      // 使用缓存的牌型计算
      const midType = getCachedHandType(middle, 'middle', typeCache);
      const headType = getCachedHandType(head, 'head', typeCache);
      const tailType = getCachedHandType(tail, 'tail', typeCache);
      
      // 增强倒水检测
      if (isFoulEnhanced(head, middle, tail, headType, midType, tailType)) continue;
      
      // 增强评分函数
      const score = enhancedScoreSplit(
        head, middle, tail, 
        headType, midType, tailType,
        headScore, tailScore
      );
      
      splits.push({ head, middle, tail, score });
    }
    if (tries > SPLIT_ENUM_LIMIT) break;
  }

  // 增强补偿策略
  if (!splits.length) {
    splits = fallbackStrategy(cards13, typeCache);
  }

  // 如果没有合法分法，退回顺序分
  if (!splits.length) {
    return [balancedSplit(cards13)];
  }
  
  // 按分数排序并返回前5
  splits.sort((a, b) => b.score - a.score);
  return splits.slice(0, 5);
}

// ================== 增强功能实现 ==================

// 增强头道组合生成
function enhancedHeadCombinations(cards, typeCache) {
  const heads = [];
  const seen = new Set();
  
  // 优先考虑对子和三条
  const groups = groupCardsByValue(cards);
  
  // 1. 添加所有三条
  for (const [value, cards] of Object.entries(groups)) {
    if (cards.length >= 3) {
      const combos = combinations(cards, 3);
      for (const combo of combos) {
        const key = combo.sort().join(',');
        if (!seen.has(key)) {
          seen.add(key);
          const type = '三条';
          const score = TYPE_WEIGHTS.head[type] + getTotalValue(combo) * 1.2;
          heads.push({ head: combo, headScore: score });
        }
      }
    }
  }
  
  // 2. 添加所有对子
  for (const [value, cards] of Object.entries(groups)) {
    if (cards.length >= 2) {
      const pairs = combinations(cards, 2);
      for (const pair of pairs) {
        // 为每个对子添加第三张牌
        const others = cards.filter(c => !pair.includes(c));
        const remaining = cards13.filter(c => !pair.includes(c));
        
        // 取最高点数的第三张牌
        if (others.length > 0) {
          others.sort((a, b) => cardValue(b) - cardValue(a));
          const headCombo = [...pair, others[0]];
          const key = headCombo.sort().join(',');
          if (!seen.has(key)) {
            seen.add(key);
            const type = '对子';
            const score = TYPE_WEIGHTS.head[type] + getTotalValue(headCombo) * 1.15;
            heads.push({ head: headCombo, headScore: score });
          }
        }
      }
    }
  }
  
  // 3. 添加高牌组合（点数最高的3张牌）
  if (heads.length < TOP_N_HEAD) {
    const sorted = [...cards13].sort((a, b) => cardValue(b) - cardValue(a));
    const highCombo = sorted.slice(0, 3);
    const key = highCombo.sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      const type = '高牌';
      const score = TYPE_WEIGHTS.head[type] + getTotalValue(highCombo);
      heads.push({ head: highCombo, headScore: score });
    }
  }
  
  // 按分数排序
  return heads.sort((a, b) => b.headScore - a.headScore);
}

// 增强尾道组合生成
function enhancedTailCombinations(cards, typeCache) {
  const tails = [];
  const seen = new Set();
  
  // 1. 检测并添加同花顺
  const straightFlushes = findStraightFlushes(cards);
  for (const sf of straightFlushes) {
    const key = sf.sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      const type = '同花顺';
      const score = TYPE_WEIGHTS.tail[type] + getTotalValue(sf) * 1.8;
      tails.push({ tail: sf, tailScore: score });
    }
  }
  
  // 2. 检测并添加铁支
  const groups = groupCardsByValue(cards);
  for (const [value, cards] of Object.entries(groups)) {
    if (cards.length === 4) {
      // 添加铁支
      const key = cards.sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        const type = '铁支';
        const score = TYPE_WEIGHTS.tail[type] + getTotalValue(cards) * 1.7;
        tails.push({ tail: cards, tailScore: score });
      }
    }
  }
  
  // 3. 检测并添加葫芦
  const fullHouses = findFullHouses(cards);
  for (const fh of fullHouses) {
    const key = fh.sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      const type = '葫芦';
      const score = TYPE_WEIGHTS.tail[type] + getTotalValue(fh) * 1.6;
      tails.push({ tail: fh, tailScore: score });
    }
  }
  
  // 4. 添加高点数组合
  if (tails.length < TOP_N_TAIL) {
    const sorted = [...cards].sort((a, b) => cardValue(b) - cardValue(a));
    const highCombo = sorted.slice(0, 5);
    const key = highCombo.sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      const type = getCachedHandType(highCombo, 'tail', typeCache);
      const score = TYPE_WEIGHTS.tail[type] || 0 + getTotalValue(highCombo) * 1.4;
      tails.push({ tail: highCombo, tailScore: score });
    }
  }
  
  // 按分数排序
  return tails.sort((a, b) => b.tailScore - a.tailScore);
}

// 增强倒水检测
function isFoulEnhanced(head, middle, tail, headType, midType, tailType) {
  // 获取牌型等级
  const headRank = handTypeRank(headType, 'head');
  const midRank = handTypeRank(midType, 'middle');
  const tailRank = handTypeRank(tailType, 'tail');
  
  // 头道 > 中道 或 中道 > 尾道
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  
  // 同牌型比较
  if (headRank === midRank && compareAreaEnhanced(head, middle, headType) > 0) return true;
  if (midRank === tailRank && compareAreaEnhanced(middle, tail, midType) > 0) return true;
  
  return false;
}

// 增强区域比较
function compareAreaEnhanced(a, b, type) {
  const valueA = getHandStrength(a, type);
  const valueB = getHandStrength(b, type);
  return valueB - valueA; // 降序排序
}

// 获取牌型强度
function getHandStrength(cards, type) {
  const baseScore = handTypeScore(type);
  let valueScore = 0;
  
  // 根据牌型计算值分数
  switch(type) {
    case '三条':
    case '铁支':
      const mainValue = mostCommonValue(cards);
      valueScore = cardValue(mainValue) * 10;
      break;
      
    case '对子':
    case '两对':
    case '葫芦':
      const values = cards.map(cardValue);
      values.sort((a, b) => b - a);
      valueScore = values.reduce((sum, val, idx) => sum + val * (10 - idx), 0);
      break;
      
    default:
      valueScore = getTotalValue(cards);
  }
  
  return baseScore * 100 + valueScore;
}

// 增强评分函数
function enhancedScoreSplit(head, mid, tail, headType, midType, tailType, headScore, tailScore) {
  // 基础分数
  let score = 
    handTypeScore(tailType) * 150 +
    handTypeScore(midType) * 25 +
    handTypeScore(headType) * 5;
  
  // 牌型特定奖励
  score += TYPE_WEIGHTS.head[headType] || 0;
  score += TYPE_WEIGHTS.middle[midType] || 0;
  score += TYPE_WEIGHTS.tail[tailType] || 0;
  
  // 点数加权（不同区域不同权重）
  score += getTotalValue(head) * 0.75 + 
           getTotalValue(mid) * 1.05 + 
           getTotalValue(tail) * 1.5;
  
  // 连接性奖励（相邻区域牌型关联）
  if (isConnectedType(headType, midType)) {
    score += 15;
  }
  if (isConnectedType(midType, tailType)) {
    score += 20;
  }
  
  // 特殊牌型检测
  if (isSpecialType(head, mid, tail)) {
    score += SPECIAL_TYPE_BONUS;
  }
  
  // 避免拆散好牌的惩罚
  if (isBreakingGoodHand(head, mid, tail, headType, midType, tailType)) {
    score -= 40;
  }
  
  return score;
}

// 增强补偿策略
function fallbackStrategy(cards13, typeCache) {
  const splits = [];
  const candidateHeads = [];
  
  // 策略1：尝试所有可能的三条
  const groups = groupCardsByValue(cards13);
  for (const [value, cards] of Object.entries(groups)) {
    if (cards.length >= 3) {
      candidateHeads.push(...combinations(cards, 3));
    }
  }
  
  // 策略2：尝试所有可能的对子
  for (const [value, cards] of Object.entries(groups)) {
    if (cards.length >= 2) {
      const pairs = combinations(cards, 2);
      for (const pair of pairs) {
        // 取剩余牌中最大的一张
        const others = cards13.filter(c => !pair.includes(c));
        if (others.length > 0) {
          others.sort((a, b) => cardValue(b) - cardValue(a));
          candidateHeads.push([...pair, others[0]]);
        }
      }
    }
  }
  
  // 策略3：添加高点数组合
  const sorted = [...cards13].sort((a, b) => cardValue(b) - cardValue(a));
  candidateHeads.push(sorted.slice(0, 3));
  
  // 对每个候选头道尝试分牌
  for (const head of candidateHeads.slice(0, 15)) {
    const left10 = cards13.filter(c => !head.includes(c));
    
    // 尝试所有可能的尾道
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

// 特殊牌型检测
function detectSpecialTypeSplit(cards13) {
  // 1. 三同花检测
  const suitGroups = groupCardsBySuit(cards13);
  const flushGroups = Object.values(suitGroups).filter(g => g.length >= 3);
  
  if (flushGroups.length >= 3) {
    // 尝试找到三组同花
    flushGroups.sort((a, b) => b.length - a.length);
    
    // 分配头道、中道、尾道
    const head = flushGroups[0].slice(0, 3);
    const tail = flushGroups[1].slice(0, 5);
    const mid = [];
    
    // 收集剩余牌
    const used = new Set([...head, ...tail]);
    for (const group of flushGroups) {
      for (const card of group) {
        if (!used.has(card) && mid.length < 5) {
          mid.push(card);
          used.add(card);
        }
      }
    }
    
    // 如果中道不足5张，从最大组补足
    if (mid.length < 5) {
      const remaining = cards13.filter(c => !used.has(c));
      remaining.sort((a, b) => cardValue(b) - cardValue(a));
      mid.push(...remaining.slice(0, 5 - mid.length));
    }
    
    if (head.length === 3 && mid.length === 5 && tail.length === 5) {
      const score = 1000 + SPECIAL_TYPE_BONUS; // 特殊高分
      return { head, middle: mid, tail, score };
    }
  }
  
  // 2. 三顺子检测
  const straights = findPotentialStraights(cards13);
  if (straights.length >= 3) {
    // 按长度排序
    straights.sort((a, b) => b.length - a.length);
    
    // 尝试分配
    for (let i = 0; i < straights.length; i++) {
      for (let j = 0; j < straights.length; j++) {
        if (i === j) continue;
        for (let k = 0; k < straights.length; k++) {
          if (i === k || j === k) continue;
          
          const head = straights[i].slice(0, 3);
          const mid = straights[j].slice(0, 5);
          const tail = straights[k].slice(0, 5);
          
          // 检查是否冲突
          const allCards = [...head, ...mid, ...tail];
          if (new Set(allCards).size === 13) {
            const score = 950 + SPECIAL_TYPE_BONUS;
            return { head, middle: mid, tail, score };
          }
        }
      }
    }
  }
  
  // 3. 一条龙检测
  const uniqueValues = new Set(cards13.map(getCardValue));
  if (uniqueValues.size === 13) {
    // 按点数排序
    const sorted = [...cards13].sort((a, b) => {
      const valA = cardValue(a);
      const valB = cardValue(b);
      return valA - valB;
    });
    
    // 分配头道、中道、尾道
    const head = sorted.slice(0, 3);
    const mid = sorted.slice(3, 8);
    const tail = sorted.slice(8, 13);
    
    const score = 1100 + SPECIAL_TYPE_BONUS;
    return { head, middle: mid, tail, score };
  }
  
  return null;
}

// ================== 辅助工具函数 ==================

// 分组牌（按点数）
function groupCardsByValue(cards) {
  const groups = {};
  for (const card of cards) {
    const value = getCardValue(card);
    if (!groups[value]) groups[value] = [];
    groups[value].push(card);
  }
  return groups;
}

// 分组牌（按花色）
function groupCardsBySuit(cards) {
  const groups = {};
  for (const card of cards) {
    const suit = getCardSuit(card);
    if (!groups[suit]) groups[suit] = [];
    groups[suit].push(card);
  }
  return groups;
}

// 查找可能的顺子
function findPotentialStraights(cards) {
  const values = cards.map(cardValue);
  const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
  const straights = [];
  
  // 检测标准顺子
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    let isStraight = true;
    for (let j = 1; j < 5; j++) {
      if (uniqueValues[i + j] !== uniqueValues[i] + j) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) {
      const straightValues = uniqueValues.slice(i, i + 5);
      const straightCards = cards.filter(card => 
        straightValues.includes(cardValue(card))
        .sort((a, b) => cardValue(a) - cardValue(b));
      straights.push(straightCards);
    }
  }
  
  // 检测A-2-3-4-5特殊顺子
  if (uniqueValues.includes(14) && uniqueValues.includes(2)) {
    const lowValues = [14, 2, 3, 4, 5];
    if (lowValues.every(v => uniqueValues.includes(v))) {
      const straightCards = cards.filter(card => 
        lowValues.includes(cardValue(card))
        .sort((a, b) => {
          // 特殊排序：A放在最后
          const valA = cardValue(a) === 14 ? 1 : cardValue(a);
          const valB = cardValue(b) === 14 ? 1 : cardValue(b);
          return valA - valB;
        });
      straights.push(straightCards);
    }
  }
  
  return straights;
}

// 查找同花顺
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

// 查找葫芦
function findFullHouses(cards) {
  const groups = groupCardsByValue(cards);
  const triplets = [];
  const pairs = [];
  
  // 收集三条和对子
  for (const [value, cards] of Object.entries(groups)) {
    if (cards.length >= 3) {
      triplets.push(...combinations(cards, 3));
    }
    if (cards.length >= 2) {
      pairs.push(...combinations(cards, 2));
    }
  }
  
  // 组合成葫芦
  const fullHouses = [];
  for (const triplet of triplets) {
    for (const pair of pairs) {
      // 确保不重复使用牌
      if (triplet.every(c => !pair.includes(c))) {
        fullHouses.push([...triplet, ...pair]);
      }
    }
  }
  
  return fullHouses;
}

// 获取缓存的牌型
function getCachedHandType(cards, area, cache) {
  const key = cards.sort().join(',') + area;
  if (cache.has(key)) return cache.get(key);
  
  const type = handType(cards, area);
  cache.set(key, type);
  return type;
}

// 检查牌型是否连接
function isConnectedType(type1, type2) {
  const connections = {
    '顺子': ['顺子', '同花顺'],
    '同花': ['同花', '同花顺'],
    '三条': ['葫芦'],
    '对子': ['两对', '葫芦']
  };
  
  return (connections[type1] && connections[type1].includes(type2)) ||
         (connections[type2] && connections[type2].includes(type1));
}

// 检查是否拆散好牌
function isBreakingGoodHand(head, mid, tail, headType, midType, tailType) {
  // 检查是否拆散同花
  const allCards = [...head, ...mid, ...tail];
  const suitGroups = groupCardsBySuit(allCards);
  
  for (const suit in suitGroups) {
    const group = suitGroups[suit];
    if (group.length >= 5) {
      // 检查同花是否被拆分到多个区域
      const inHead = head.filter(c => getCardSuit(c) === suit).length;
      const inMid = mid.filter(c => getCardSuit(c) === suit).length;
      const inTail = tail.filter(c => getCardSuit(c) === suit).length;
      
      // 如果同花被拆分到多个区域
      if ([inHead, inMid, inTail].filter(count => count > 0).length > 1) {
        return true;
      }
    }
  }
  
  // 检查是否拆散顺子
  const values = allCards.map(cardValue);
  const sortedValues = [...new Set(values)].sort((a, b) => a - b);
  
  // 检测潜在的长顺子
  let maxStreak = 0;
  let currentStreak = 1;
  for (let i = 1; i < sortedValues.length; i++) {
    if (sortedValues[i] === sortedValues[i-1] + 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }
  
  // 如果有6张以上的顺子被拆分
  if (maxStreak >= 6) {
    // 检查顺子是否被拆分到多个区域
    const sequenceCards = allCards.filter(card => {
      const value = cardValue(card);
      return value >= sortedValues[0] && value <= sortedValues[0] + maxStreak - 1;
    });
    
    const inHead = head.filter(c => sequenceCards.includes(c)).length;
    const inMid = mid.filter(c => sequenceCards.includes(c)).length;
    const inTail = tail.filter(c => sequenceCards.includes(c)).length;
    
    // 如果顺子被拆分到多个区域
    if ([inHead, inMid, inTail].filter(count => count > 0).length > 1) {
      return true;
    }
  }
  
  return false;
}

// ================== 原有函数保持兼容 ==================
// 注意：以下是原有函数的兼容实现，保持原有功能
// 但部分函数使用了上面新定义的增强功能

function combinations(arr, k) {
  // ... 原有实现保持不变 ...
}

function isFoul(head, middle, tail) {
  // 使用增强版实现
  const headType = handType(head, 'head');
  const midType = handType(middle, 'middle');
  const tailType = handType(tail, 'tail');
  return isFoulEnhanced(head, middle, tail, headType, midType, tailType);
}

function evalHead(head) {
  // 使用增强版实现中的部分逻辑
  const type = handType(head, 'head');
  let score = TYPE_WEIGHTS.head[type] || 0;
  score += getTotalValue(head) * (type === '三条' ? 1.2 : 1.15);
  return score;
}

function evalTail(tail) {
  // 使用增强版实现中的部分逻辑
  const type = handType(tail, 'tail');
  let score = TYPE_WEIGHTS.tail[type] || 0;
  score += getTotalValue(tail) * (type === '同花顺' ? 1.8 : 1.6);
  return score;
}

function scoreSplit(head, mid, tail) {
  // 使用增强版实现
  const headType = handType(head, 'head');
  const midType = handType(mid, 'middle');
  const tailType = handType(tail, 'tail');
  return enhancedScoreSplit(
    head, mid, tail, 
    headType, midType, tailType,
    evalHead(head), evalTail(tail)
  );
}

function handType(cards, area) {
  // ... 原有实现保持不变 ...
}

function isStraight(vals) {
  // ... 原有实现保持不变 ...
}

// ... 其他原有函数保持不变 ...
