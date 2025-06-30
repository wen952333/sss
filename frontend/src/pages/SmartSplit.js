// ================== 核心常量与配置 ==================
const SPLIT_ENUM_LIMIT = 2500;
const TOP_N_HEAD = 12;
const TOP_N_TAIL = 15;
const SPECIAL_TYPE_BONUS = 120;
const CONNECTION_BONUS = 25; // 新增牌型连接性奖励

const TYPE_WEIGHTS = {
  'head': { '三条': 45, '对子': 15, '高牌': -18 },
  'middle': {
    '同花顺': 38, '铁支': 45, '葫芦': 28, '顺子': 15, '同花': 12,
    '三条': 10, '两对': 5, '对子': -8, '高牌': -15
  },
  'tail': { '铁支': 65, '同花顺': 55, '葫芦': 32, '顺子': 18 }
};

// 牌型连接奖励映射
const TYPE_CONNECTIONS = {
  '对子': ['两对', '葫芦'],
  '三条': ['葫芦'],
  '顺子': ['同花顺'],
  '同花': ['同花顺']
};


// ================== 主接口 ==================
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  
  // 预检测特殊牌型（增强特殊牌型检测）
  const specialSplit = detectSpecialTypeSplit(cards13);
  if (specialSplit) return [specialSplit];

  const typeCache = new Map();
  let allHead = enhancedHeadCombinations(cards13, typeCache).slice(0, TOP_N_HEAD);
  let splits = []; 
  let tries = 0;

  for (const { head, headScore } of allHead) {
    const left10 = cards13.filter(c => !head.includes(c));
    let allTail = enhancedTailCombinations(left10, typeCache).slice(0, TOP_N_TAIL);
    
    for (const { tail, tailScore } of allTail) {
      const middle = left10.filter(c => !tail.includes(c));
      if (middle.length !== 5) continue;
      
      tries++; 
      if (tries > SPLIT_ENUM_LIMIT) break;
      
      // 使用缓存提高性能
      const midType = getCachedHandType(middle, 'middle', typeCache);
      const headType = getCachedHandType(head, 'head', typeCache);
      const tailType = getCachedHandType(tail, 'tail', typeCache);
      
      // 增强倒水检测（修复逻辑）
      if (isFoulEnhanced(head, middle, tail, headType, midType, tailType)) continue;
      
      // 增强评分函数（增加连接性奖励）
      const score = enhancedScoreSplit(
        head, middle, tail, 
        headType, midType, tailType, 
        headScore, tailScore
      );
      
      splits.push({ head, middle, tail, score });
    }
    if (tries > SPLIT_ENUM_LIMIT) break;
  }

  // 增强补偿策略（避免空结果）
  if (!splits.length) splits = fallbackStrategy(cards13, typeCache);
  if (!splits.length) return [balancedSplit(cards13)];
  
  splits.sort((a, b) => b.score - a.score);
  return splits.slice(0, 5).map(s => ({ 
    head: s.head, 
    middle: s.middle, 
    tail: s.tail 
  }));
}

export function aiSmartSplit(cards13) {
  const splits = getSmartSplits(cards13);
  return splits[0] || { 
    head: cards13.slice(0, 3), 
    middle: cards13.slice(3, 8), 
    tail: cards13.slice(8, 13) 
  };
}

export function getPlayerSmartSplits(cards13) {
  return getSmartSplits(cards13);
}

export function fillAiPlayers(playersArr) {
  return playersArr.map(p =>
    p.isAI && Array.isArray(p.cards13) && p.cards13.length === 13
      ? { ...p, ...aiSmartSplit(p.cards13) }
      : p
  );
}


// ================== 增强功能实现 ==================

function enhancedHeadCombinations(cards, typeCache) {
  const heads = [], seen = new Set();
  const groups = groupCardsByValue(cards);

  // 1. 三条组合
  for (const value in groups) {
    if (groups[value].length >= 3) {
      const combos = combinations(groups[value], 3);
      for (const combo of combos) {
        const key = combo.slice().sort().join(',');
        if (!seen.has(key)) {
          seen.add(key);
          heads.push({ 
            head: combo, 
            headScore: TYPE_WEIGHTS.head['三条'] + getTotalValue(combo) * 1.2 
          });
        }
      }
    }
  }
  
  // 2. 对子组合（增强：选择最佳第三张牌）
  for (const value in groups) {
    if (groups[value].length >= 2) {
      const pairs = combinations(groups[value], 2);
      for (const pair of pairs) {
        const others = cards.filter(c => !pair.includes(c));
        if (others.length > 0) {
          // 优先选择高点数牌作为第三张
          const sortedOthers = [...others].sort((a, b) => cardValue(b) - cardValue(a));
          const headCombo = [...pair, sortedOthers[0]];
          
          const key = headCombo.slice().sort().join(',');
          if (!seen.has(key)) {
            seen.add(key);
            heads.push({ 
              head: headCombo, 
              headScore: TYPE_WEIGHTS.head['对子'] + getTotalValue(headCombo) * 1.15 
            });
          }
        }
      }
    }
  }
  
  // 3. 高牌组合（确保至少TOP_N_HEAD个候选）
  if (heads.length < TOP_N_HEAD) {
    const highCombo = cards.slice()
      .sort((a, b) => cardValue(b) - cardValue(a))
      .slice(0, 3);
    
    const key = highCombo.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      heads.push({ 
        head: highCombo, 
        headScore: TYPE_WEIGHTS.head['高牌'] + getTotalValue(highCombo) 
      });
    }
  }
  
  return heads.sort((a, b) => b.headScore - a.headScore);
}

function enhancedTailCombinations(cards, typeCache) {
  const tails = [], seen = new Set();
  
  // 1. 同花顺（增强检测）
  const straightFlushes = findStraightFlushes(cards);
  for (const sf of straightFlushes) {
    const key = sf.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key); 
      tails.push({ 
        tail: sf, 
        tailScore: TYPE_WEIGHTS.tail['同花顺'] + getTotalValue(sf) * 1.8 
      });
    }
  }
  
  // 2. 铁支
  const groups = groupCardsByValue(cards);
  for (const value in groups) {
    if (groups[value].length === 4) {
      const combo = groups[value];
      const key = combo.slice().sort().join(',');
      if (!seen.has(key)) {
        seen.add(key); 
        tails.push({ 
          tail: combo, 
          tailScore: TYPE_WEIGHTS.tail['铁支'] + getTotalValue(combo) * 1.7 
        });
      }
    }
  }
  
  // 3. 葫芦（增强检测）
  const fullHouses = findFullHouses(cards);
  for (const fh of fullHouses) {
    const key = fh.slice().sort().join(',');
    if (!seen.has(key)) {
      seen.add(key); 
      tails.push({ 
        tail: fh, 
        tailScore: TYPE_WEIGHTS.tail['葫芦'] + getTotalValue(fh) * 1.6 
      });
    }
  }
  
  // 4. 高点数组合
  if (tails.length < TOP_N_TAIL) {
    const highCombo = cards.slice()
      .sort((a, b) => cardValue(b) - cardValue(a))
      .slice(0, 5);
    
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
  
  // 1. 检查牌型等级顺序
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  
  // 2. 检查相同牌型的大小（修复原逻辑缺失）
  if (headRank === midRank && compareArea(head, middle, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(middle, tail, 'middle') > 0) return true;
  
  return false;
}

function enhancedScoreSplit(head, mid, tail, headType, midType, tailType, headScore, tailScore) {
  let score =
    handTypeScore(tailType) * 150 +
    handTypeScore(midType) * 25 +
    handTypeScore(headType) * 5;
  
  // 牌型特定奖励
  score += TYPE_WEIGHTS.head[headType] || 0;
  score += TYPE_WEIGHTS.middle[midType] || 0;
  score += TYPE_WEIGHTS.tail[tailType] || 0;
  
  // 点数加权
  score += getTotalValue(head) * 0.75 + 
           getTotalValue(mid) * 1.05 + 
           getTotalValue(tail) * 1.5;

  // 新增：牌型连接性奖励
  score += getConnectionBonus(headType, midType, tailType);
  
  // 特殊牌型奖励
  if (isSpecialType(head, mid, tail)) score += SPECIAL_TYPE_BONUS;
  
  // 拆散好牌惩罚
  if (isBreakingGoodHand(head, mid, tail, headType, midType, tailType)) score -= 40;
  
  return score;
}

// 新增：牌型连接性奖励计算
function getConnectionBonus(headType, midType, tailType) {
  let bonus = 0;
  
  // 头道-中道连接
  if (TYPE_CONNECTIONS[headType] && TYPE_CONNECTIONS[headType].includes(midType)) {
    bonus += CONNECTION_BONUS;
  }
  
  // 中道-尾道连接
  if (TYPE_CONNECTIONS[midType] && TYPE_CONNECTIONS[midType].includes(tailType)) {
    bonus += CONNECTION_BONUS;
  }
  
  return bonus;
}

function fallbackStrategy(cards13, typeCache) {
  const splits = [];
  const groups = groupCardsByValue(cards13);
  let candidateHeads = [];
  
  // 1. 三条候选
  for (const value in groups) {
    if (groups[value].length >= 3) {
      candidateHeads.push(...combinations(groups[value], 3));
    }
  }
  
  // 2. 对子候选（增强：选择最佳第三张牌）
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
  
  // 3. 高点数候选
  candidateHeads.push(
    cards13.slice()
      .sort((a, b) => cardValue(b) - cardValue(a))
      .slice(0, 3)
  );
  
  // 尝试每个候选头道
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
  // 1. 三同花检测（逻辑修复）
  const suitGroups = groupCardsBySuit(cards13);
  const flushGroups = Object.values(suitGroups).filter(g => g.length >= 3);
  
  if (flushGroups.length >= 3) {
    flushGroups.sort((a, b) => b.length - a.length);
    
    // 分配头道、中道、尾道
    const head = flushGroups[0].slice(0, 3);
    const tail = flushGroups[1].slice(0, 5);
    const mid = [];
    
    const used = new Set([...head, ...tail]);
    
    // 从第三组同花开始填充中道
    for (let i = 2; i < flushGroups.length; i++) {
      for (const card of flushGroups[i]) {
        if (mid.length < 5 && !used.has(card)) {
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
      const score = 1000 + SPECIAL_TYPE_BONUS;
      return { head, middle: mid, tail, score };
    }
  }
  
  // 2. 三顺子检测（优化组合效率）
  const straights = findPotentialStraights(cards13);
  if (straights.length >= 3) {
    // 按长度排序
    straights.sort((a, b) => b.length - a.length);
    
    // 尝试分配（避免重复组合）
    for (let i = 0; i < straights.length - 2; i++) {
      for (let j = i + 1; j < straights.length - 1; j++) {
        for (let k = j + 1; k < straights.length; k++) {
          const head = straights[i].slice(0, 3);
          const mid = straights[j].slice(0, 5);
          const tail = straights[k].slice(0, 5);
          
          // 检查冲突
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
  const uniqueValues = new Set(cards13.map(cardValue));
  if (uniqueValues.size === 13) {
    // 按点数排序（A作为14）
    const sorted = cards13.slice().sort((a, b) => cardValue(a) - cardValue(b));
    
    // 分配
    const head = sorted.slice(0, 3);
    const mid = sorted.slice(3, 8);
    const tail = sorted.slice(8, 13);
    
    const score = 1100 + SPECIAL_TYPE_BONUS;
    return { head, middle: mid, tail, score };
  }
  
  return null;
}


// ================== 辅助工具函数 ==================
function groupCardsByValue(cards) {
  const groups = {};
  for (const card of cards) {
    const value = cardValue(card);
    if (!groups[value]) groups[value] = [];
    groups[value].push(card);
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

function findPotentialStraights(cards) {
  const vals = cards.map(cardValue);
  const uniqueVals = [...new Set(vals)].sort((a, b) => a - b);
  const straights = [];
  
  // 检测标准顺子
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    let isStraight = true;
    for (let j = 1; j < 5; j++) {
      if (uniqueVals[i + j] !== uniqueVals[i] + j) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) {
      const straightVals = uniqueVals.slice(i, i + 5);
      const straightCards = cards.filter(card => 
        straightVals.includes(cardValue(card))
        .sort((a, b) => cardValue(a) - cardValue(b));
      straights.push(straightCards);
    }
  }
  
  // 检测A-2-3-4-5特殊顺子（逻辑修复）
  const lowStraightValues = [14, 2, 3, 4, 5];
  const hasLowStraight = lowStraightValues.every(v => 
    uniqueVals.includes(v)
  );
  
  if (hasLowStraight) {
    const straightCards = cards.filter(card => 
      lowStraightValues.includes(cardValue(card))
      .sort((a, b) => {
        // 特殊排序：A作为1
        const valA = cardValue(a) === 14 ? 1 : cardValue(a);
        const valB = cardValue(b) === 14 ? 1 : cardValue(b);
        return valA - valB;
      });
    straights.push(straightCards);
  }
  
  return straights;
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

function findFullHouses(cards) {
  const groups = groupCardsByValue(cards);
  const triplets = [];
  const pairs = [];
  
  // 收集三条和对子
  for (const value in groups) {
    if (groups[value].length >= 3) {
      triplets.push(...combinations(groups[value], 3));
    }
    if (groups[value].length >= 2) {
      pairs.push(...combinations(groups[value], 2));
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

function getCachedHandType(cards, area, cache) {
  const key = cards.slice().sort().join(',') + area;
  if (cache.has(key)) return cache.get(key);
  
  const type = handType(cards, area);
  cache.set(key, type);
  return type;
}

function isSpecialType(head, mid, tail) {
  const all = [...head, ...mid, ...tail];
  
  // 1. 一条龙：13张不同点数
  const uniqueValues = new Set(all.map(cardValue));
  if (uniqueValues.size === 13) return true;
  
  // 2. 三同花：三道各自同花
  const headSuit = new Set(head.map(cardSuit));
  const midSuit = new Set(mid.map(cardSuit));
  const tailSuit = new Set(tail.map(cardSuit));
  
  if (headSuit.size === 1 && midSuit.size === 1 && tailSuit.size === 1) {
    return true;
  }
  
  // 3. 三顺子：三道各自顺子
  const headIsStraight = isStraight(head.map(cardValue));
  const midIsStraight = isStraight(mid.map(cardValue));
  const tailIsStraight = isStraight(tail.map(cardValue));
  
  if (headIsStraight && midIsStraight && tailIsStraight) {
    return true;
  }
  
  return false;
}

function isBreakingGoodHand(head, mid, tail, headType, midType, tailType) {
  const allCards = [...head, ...mid, ...tail];
  
  // 1. 检查拆散同花
  const suitGroups = groupCardsBySuit(allCards);
  for (const suit in suitGroups) {
    if (suitGroups[suit].length >= 5) {
      const inHead = head.filter(c => cardSuit(c) === suit).length;
      const inMid = mid.filter(c => cardSuit(c) === suit).length;
      const inTail = tail.filter(c => cardSuit(c) === suit).length;
      
      // 如果同花被拆分到多个区域
      if ([inHead, inMid, inTail].filter(cnt => cnt > 0).length > 1) {
        return true;
      }
    }
  }
  
  // 2. 检查拆散长顺子
  const vals = allCards.map(cardValue);
  const uniqueVals = [...new Set(vals)].sort((a, b) => a - b);
  
  // 检测6张以上的顺子
  let maxStreak = 0, currentStreak = 1;
  for (let i = 1; i < uniqueVals.length; i++) {
    if (uniqueVals[i] === uniqueVals[i-1] + 1) {
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
    
    // 如果长顺子被拆分到多个区域
    if ([inHead, inMid, inTail].filter(count => count > 0).length > 1) {
      return true;
    }
  }
  
  return false;
}


// ================== 原有兼容基础函数 ==================
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
  return { 
    head: sorted.slice(0, 3), 
    middle: sorted.slice(3, 8), 
    tail: sorted.slice(8, 13) 
  };
}

function getTotalValue(cards) {
  return cards.reduce((sum, card) => sum + cardValue(card), 0);
}

function cardValue(card) {
  const v = card.split('_')[0];
  if (v === 'ace') return 14;
  if (v === 'king') return 13;
  if (v === 'queen') return 12;
  if (v === 'jack') return 11;
  return parseInt(v, 10);
}

function cardSuit(card) {
  // 修复：统一使用_分割后的第二部分作为花色
  return card.split('_')[1];
}

function handType(cards, area) {
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[1]); // 修复：使用正确的花色索引
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
  
  // 标准顺子检测
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] !== idxs[i - 1] + 1) {
      // 检查A-2-3-4-5特殊顺子
      if (idxs.includes(0) && idxs.includes(1) && idxs.includes(2) && 
          idxs.includes(3) && idxs.includes(12)) {
        return true;
      }
      break;
    }
    if (i === idxs.length - 1) return true;
  }
  
  return false;
}

function handTypeScore(type) {
  switch (type) {
    case "铁支": return 8;
    case "同花顺": return 7;
    case "葫芦": return 6;
    case "同花": return 5;
    case "顺子": return 4;
    case "三条": return 3;
    case "两对": return 2;
    case "对子": return 1;
    default: return 0;
  }
}

function handTypeRank(type, area) {
  if (area === 'head') {
    if (type === "三条") return 4;
    if (type === "对子") return 2;
    return 1;
  }
  return handTypeScore(type);
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

function groupBy(arr) {
  const g = {};
  arr.forEach(x => { 
    g[x] = g[x] || []; 
    g[x].push(x); 
  });
  return g;
}

function compareArea(a, b, area) {
  const typeA = handType(a, area);
  const typeB = handType(b, area);
  const rankA = handTypeRank(typeA, area);
  const rankB = handTypeRank(typeB, area);
  
  if (rankA !== rankB) return rankA - rankB;
  
  // 点数比较
  const totalA = getTotalValue(a);
  const totalB = getTotalValue(b);
  
  return totalB - totalA;
}
