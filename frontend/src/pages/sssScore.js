/**
 * sssScore.final.js - 十三水最终版比牌计分器
 * 
 * --- 核心功能与规则 ---
 * 1.  牌型体系:
 *     - 普通牌型: 同花顺 > 铁支 > 葫芦 > 同花 > 顺子 > 三条 > 两对 > 对子 > 高牌。
 *     - 特殊牌型: 一条龙 > 三同花/三顺子 > 六对半。
 * 2.  特殊顺子规则:
 *     - A-K-Q-J-10 为最大顺子/同花顺。
 *     - A-2-3-4-5 为第二大顺子/同花顺。
 * 3.  无平局规则:
 *     - 普通牌型比牌时，如点数完全相同，则按“关键牌”的花色决定胜负。
 *     - 花色顺序: 黑桃 > 红桃 > 梅花 > 方块。
 * 4.  特殊牌型结算:
 *     - 特殊牌型 vs 普通牌型: 按特殊牌型分数结算。
 *     - 特殊牌型 vs 特殊牌型: 计为平局 (0分)。
 * 5.  倒水 (相公) 规则:
 *     - 倒水方直接输给未倒水方，赔付对方牌力对应的总分。
 *     - 双方都倒水则为平局。
 * 6.  完整计分:
 *     - 支持各道加分牌 (马牌)。
 *     - 支持“打枪” (三道全胜得分x2)。
 *     - 支持“全垒打” (通杀全场总分再x2)。
 */

// --- 常量定义区 ---
const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
};
const SUIT_ORDER = { spades: 4, hearts: 3, clubs: 2, diamonds: 1 };

// --- 规则配置区 ---
const SCORES = {
  // 各道牌型加分
  HEAD: { '三条': 3 },
  MIDDLE: { '铁支': 8, '同花顺': 10, '葫芦': 2 },
  TAIL: { '铁支': 4, '同花顺': 5 },
  // 特殊牌型基础分
  SPECIAL: { '一条龙': 13, '三同花': 4, '三顺子': 4, '六对半': 3 },
  // 翻倍规则
  GUNSHOT_MULTIPLIER: 2,
  HOMERUN_MULTIPLIER: 2,
};


// --- 主计算函数 ---
export function calcSSSAllScores(players) {
  const N = players.length;
  if (N < 2) return new Array(N).fill(0);

  let marks = new Array(N).fill(0);
  
  const playerInfos = players.map(p => {
    const isFoul = isFoul(p.head, p.middle, p.tail);
    // 注意：倒水的玩家不可能有特殊牌型
    const specialType = isFoul ? null : getSpecialType(p);
    return { ...p, isFoul, specialType };
  });

  const gunshotLog = Array.from({ length: N }, () => new Array(N).fill(false));

  // 两两比较计分
  for (let i = 0; i < N; ++i) {
    for (let j = i + 1; j < N; ++j) {
      const p1 = playerInfos[i];
      const p2 = playerInfos[j];
      
      let pairScore = 0; // p1 相对于 p2 的得分

      // 1. 倒水处理
      if (p1.isFoul && !p2.isFoul) {
        pairScore = -calculateTotalBaseScore(p2);
      } else if (!p1.isFoul && p2.isFoul) {
        pairScore = calculateTotalBaseScore(p1);
      } else if (p1.isFoul && p2.isFoul) {
        pairScore = 0;
      }
      // 2. 特殊牌型处理
      else if (p1.specialType && p2.specialType) {
        pairScore = 0; // 任意两个特殊牌型相遇，都算平局
      }
      else if (p1.specialType && !p2.specialType) {
        pairScore = SCORES.SPECIAL[p1.specialType] || 0;
      }
      else if (!p1.specialType && p2.specialType) {
        pairScore = -(SCORES.SPECIAL[p2.specialType] || 0);
      }
      // 3. 普通牌型三道比较
      else {
        let p1_win_count = 0;
        let p2_win_count = 0;
        
        const areas = ['head', 'middle', 'tail'];
        for (const area of areas) {
          const cmp = compareArea(p1[area], p2[area], area);
          if (cmp > 0) {
            p1_win_count++;
            pairScore += getAreaScore(p1[area], area);
          } else if (cmp < 0) {
            p2_win_count++;
            pairScore -= getAreaScore(p2[area], area);
          }
        }
        // "打枪" 判断
        if (p1_win_count === 3) {
          pairScore *= SCORES.GUNSHOT_MULTIPLIER;
          gunshotLog[i][j] = true;
        } else if (p2_win_count === 3) {
          pairScore *= SCORES.GUNSHOT_MULTIPLIER;
          gunshotLog[j][i] = true;
        }
      }

      marks[i] += pairScore;
      marks[j] -= pairScore;
    }
  }

  // 4. "全垒打" 处理
  for (let i = 0; i < N; ++i) {
    // 统计玩家i打枪了多少人
    const shotCount = gunshotLog[i].filter(Boolean).length;
    // 如果玩家i打枪了其他所有玩家
    if (N > 1 && shotCount === N - 1) {
      // 玩家i的总分再翻倍（输家扣分也对应翻倍）
      const originalScore = marks[i];
      const bonus = originalScore * (SCORES.HOMERUN_MULTIPLIER - 1);
      marks[i] += bonus;
      for (let j = 0; j < N; j++) {
        if (i !== j) {
          marks[j] -= bonus / (N-1);
        }
      }
    }
  }

  return marks;
}


// --- 核心辅助函数 ---

/** 计算一个玩家三道或特殊牌型的基础总分（用于倒水赔付） */
function calculateTotalBaseScore(p) {
    if (p.specialType) {
        return SCORES.SPECIAL[p.specialType] || 0;
    }
    return getAreaScore(p.head, 'head') + getAreaScore(p.middle, 'middle') + getAreaScore(p.tail, 'tail');
}

/** 判定是否倒水 */
function isFoul(head, middle, tail) {
  const headRank = areaTypeRank(getAreaType(head, 'head'));
  const midRank = areaTypeRank(getAreaType(middle, 'middle'));
  const tailRank = areaTypeRank(getAreaType(tail, 'tail'));
  
  if (headRank > midRank || midRank > tailRank) return true;
  // 牌型相同时，比较牌力大小
  if (headRank === midRank && compareArea(head, middle, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(middle, tail, 'middle') > 0) return true;
  return false;
}

/** 识别特殊牌型 */
function getSpecialType(p) {
  // 规则：如果中道或尾道摆出了铁支或同花顺，则必须按普通牌型算，不能算任何特殊牌型
  const midType = getAreaType(p.middle, 'middle');
  const tailType = getAreaType(p.tail, 'tail');
  if (['铁支', '同花顺'].includes(midType) || ['铁支', '同花顺'].includes(tailType)) {
      return null;
  }

  const all = [...p.head, ...p.middle, ...p.tail];
  
  // 一条龙
  const uniqVals = new Set(all.map(c => c.split('_')[0]));
  if (uniqVals.size === 13) return '一条龙';
  
  // 六对半 (天然，不能含三条或铁支)
  const groupedAll = getGroupedValues(all);
  if (groupedAll['2']?.length === 6 && !groupedAll['3'] && !groupedAll['4']) {
    return '六对半';
  }
  
  // 三同花
  if (isFlush(p.head) && isFlush(p.middle) && isFlush(p.tail)) return '三同花';

  // 三顺子
  if (isStraight(p.head) && isStraight(p.middle) && isStraight(p.tail)) return '三顺子';

  return null;
}

/** 单墩比大小 (包含花色比较) */
function compareArea(a, b, area) {
  const typeA = getAreaType(a, area);
  const typeB = getAreaType(b, area);
  const rankA = areaTypeRank(typeA);
  const rankB = areaTypeRank(typeB);
  
  if (rankA !== rankB) return rankA - rankB;

  // 牌型相同，先比较点数
  const groupedA = getGroupedValues(a);
  const groupedB = getGroupedValues(b);

  switch (typeA) {
    case '同花顺':
    case '顺子': {
      const straightRankA = getStraightRank(a);
      const straightRankB = getStraightRank(b);
      if (straightRankA !== straightRankB) return straightRankA - straightRankB;
      break; // 顺子级别相同，则继续向下比较花色
    }
    case '铁支':
    case '葫芦':
    case '三条': {
      const mainRankA = groupedA[4]?.[0] || groupedA[3]?.[0];
      const mainRankB = groupedB[4]?.[0] || groupedB[3]?.[0];
      if (mainRankA !== mainRankB) return mainRankA - mainRankB;
      if (typeA === '葫芦') {
          const secondRankA = groupedA[2][0];
          const secondRankB = groupedB[2][0];
          if(secondRankA !== secondRankB) return secondRankA - secondRankB;
      }
      break; 
    }
    case '两对': {
      const pairsA = groupedA[2];
      const pairsB = groupedB[2];
      if (pairsA[0] !== pairsB[0]) return pairsA[0] - pairsB[0];
      if (pairsA[1] !== pairsB[1]) return pairsA[1] - pairsB[1];
      break;
    }
  }

  // 点数结构完全相同，进行最终的花色比较
  const sortedCardsA = sortCards(a);
  const sortedCardsB = sortCards(b);
  
  // 理论上点数部分在此之前都应该比较完了，但为保险起见再检查一次
  for (let i = 0; i < a.length; ++i) {
    if (sortedCardsA[i].value !== sortedCardsB[i].value) {
        return sortedCardsA[i].value - sortedCardsB[i].value;
    }
  }
  
  // 点数完全一样，比较花色
  for (let i = 0; i < a.length; ++i) {
    if (sortedCardsA[i].suit !== sortedCardsB[i].suit) {
        return sortedCardsA[i].suit - sortedCardsB[i].suit;
    }
  }

  return 0; // 只有两手牌完全一样时才会到这里（例如多副牌）
}


// --- 底层工具函数 ---

/** 获取墩类型 */
function getAreaType(cards) {
  const isF = isFlush(cards);
  const isS = isStraight(cards);
  if (isF && isS) return "同花顺";
  if (isF) return "同花";
  if (isS) return "顺子";

  const grouped = getGroupedValues(cards);
  if (grouped['4']) return "铁支";
  if (grouped['3'] && grouped['2']) return "葫芦";
  if (grouped['3']) return "三条";
  if (grouped['2']?.length === 2) return "两对";
  if (grouped['2']) return "对子";
  
  return "高牌";
}

/** 获取牌型强度等级 */
function areaTypeRank(type) {
  const ranks = { '同花顺': 9, '铁支': 8, '葫芦': 7, '同花': 6, '顺子': 5, '三条': 4, '两对': 3, '对子': 2, '高牌': 1 };
  return ranks[type] || 0;
}

/** 获取墩分数 */
function getAreaScore(cards, area) {
  const type = getAreaType(cards, area);
  const areaUpper = area.toUpperCase();
  return SCORES[areaUpper]?.[type] || 1; // 默认1分
}

/** 判断是否顺子 */
function isStraight(cards) {
  let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a,b) => a-b);
  if (vals.length !== cards.length) return false;
  const isA2345 = JSON.stringify(vals) === JSON.stringify([2,3,4,5,14]);
  const isNormalStraight = (vals[vals.length - 1] - vals[0] === cards.length - 1);
  return isNormalStraight || isA2345;
}

/** 判断是否同花 */
function isFlush(cards) {
  if (!cards || cards.length === 0) return false;
  const firstSuit = cards[0].split('_')[2];
  return cards.every(c => c.split('_')[2] === firstSuit);
}

/** 获取顺子权重 (A2345第二大规则) */
function getStraightRank(cards) {
    let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a,b) => a-b);
    if (vals.includes(14) && vals.includes(13)) return 14; // A-K-Q-J-10
    if (vals.includes(14) && vals.includes(2)) return 13.5; // A-2-3-4-5
    return vals[vals.length - 1]; // 其他顺子
}

/** 将牌按点数和花色分组 */
function getGroupedValues(cards) {
    const counts = {};
    cards.forEach(card => {
        const val = VALUE_ORDER[card.split('_')[0]];
        counts[val] = (counts[val] || 0) + 1;
    });
    const groups = {};
    for (const val in counts) {
        const count = counts[val];
        if (!groups[count]) groups[count] = [];
        groups[count].push(Number(val));
    }
    for(const count in groups) {
        groups[count].sort((a,b) => b-a); // 组内降序
    }
    return groups;
}

/** 将牌按“点数优先,花色次之”的规则排序 */
function sortCards(cards) {
    return cards.map(cardStr => {
        const [value, , suit] = cardStr.split('_');
        return { value: VALUE_ORDER[value], suit: SUIT_ORDER[suit] };
    }).sort((a, b) => b.value - a.value || b.suit - a.suit);
}
