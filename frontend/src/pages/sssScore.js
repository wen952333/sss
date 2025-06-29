/**
 * sssScore.classic.js - 十三水经典规则计分器
 * 
 * --- 核心规则 ---
 * 1.  计分方式: "基础分 + 加分"模式。
 *     - 每道胜利保底得1分。
 *     - 如获胜牌型为“加分牌”(马牌)，则替换为更高的分数。
 * 2.  保留打枪: 三道全胜时，该对局得分翻倍。
 * 3.  保留全垒打: 通杀全场时，总得分再次翻倍。
 * 4.  保留倒水: 倒水方赔付对手牌力对应的总分。
 * 5.  保留特殊牌型: 具有固定高额得分，特殊牌型之间互为平局。
 * 6.  保留无平局规则: 普通牌型比牌时，同牌力比花色定胜负。
 * 7.  保留特殊顺子规则: A-K-Q-J-10 > A-2-3-4-5 > K-Q-J-10-9 ...
 */

// --- 常量定义区 ---
const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
};
const SUIT_ORDER = { spades: 4, hearts: 3, clubs: 2, diamonds: 1 };

// --- 规则配置区 ---
const SCORES = {
  // 各道牌型加分（获胜时替换基础的1分）
  HEAD: { '三条': 3 },
  MIDDLE: { '铁支': 8, '同花顺': 10, '葫芦': 2 },
  TAIL: { '铁支': 4, '同花顺': 5 },
  // 特殊牌型基础分
  SPECIAL: { '一条龙': 13, '三同花': 4, '三顺子': 4, '六对半': 3 },
  // 翻倍规则
  GUNSHOT_MULTIPLIER: 2,
  HOMERUN_MULTIPLIER: 2, // 如果不需要全垒打，可设为 1
};


// --- 主计算函数 ---
export function calcSSSAllScores(players) {
  const N = players.length;
  if (N < 2) return new Array(N).fill(0);

  let marks = new Array(N).fill(0);
  
  const playerInfos = players.map(p => {
    const isFoul = isFoul(p.head, p.middle, p.tail);
    const specialType = isFoul ? null : getSpecialType(p);
    return { ...p, isFoul, specialType };
  });

  const gunshotLog = Array.from({ length: N }, () => new Array(N).fill(false));

  // 1. 两两结算基础分和打枪分
  for (let i = 0; i < N; ++i) {
    for (let j = i + 1; j < N; ++j) {
      const p1 = playerInfos[i];
      const p2 = playerInfos[j];
      
      let pairScore = 0;

      // 倒水处理
      if (p1.isFoul && !p2.isFoul) {
        pairScore = -calculateTotalScore(p2);
      } else if (!p1.isFoul && p2.isFoul) {
        pairScore = calculateTotalScore(p1);
      } else if (p1.isFoul && p2.isFoul) {
        pairScore = 0;
      }
      // 特殊牌型处理
      else if (p1.specialType && p2.specialType) {
        pairScore = 0;
      }
      else if (p1.specialType && !p2.specialType) {
        pairScore = SCORES.SPECIAL[p1.specialType] || 0;
      }
      else if (!p1.specialType && p2.specialType) {
        pairScore = -(SCORES.SPECIAL[p2.specialType] || 0);
      }
      // 普通牌型三道比较
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

  // 2. 全垒打处理
  if (SCORES.HOMERUN_MULTIPLIER > 1) {
    const homeRunScores = new Array(N).fill(0);
    for (let i = 0; i < N; ++i) {
      const shotCount = gunshotLog[i].filter(Boolean).length;
      if (N > 1 && shotCount === N - 1) {
        const bonus = marks[i] * (SCORES.HOMERUN_MULTIPLIER - 1);
        homeRunScores[i] += bonus;
        for (let j = 0; j < N; j++) {
          if (i !== j) {
            homeRunScores[j] -= bonus / (N - 1);
          }
        }
      }
    }
    for (let i = 0; i < N; i++) {
      marks[i] += homeRunScores[i];
    }
  }

  return marks;
}


// --- 核心辅助函数 ---

/** 计算一个玩家牌力的总分（用于倒水赔付）*/
function calculateTotalScore(p) {
    if (p.specialType) {
        return SCORES.SPECIAL[p.specialType] || 0;
    }
    return getAreaScore(p.head, 'head') + getAreaScore(p.middle, 'middle') + getAreaScore(p.tail, 'tail');
}

/** [已恢复] 获取墩分数（1分基础分或更高的加分） */
function getAreaScore(cards, area) {
  const type = getAreaType(cards, area);
  const areaUpper = area.toUpperCase();
  // 查找加分表，如果找不到，则返回1分基础分
  return SCORES[areaUpper]?.[type] || 1;
}

/** 判定是否倒水 */
function isFoul(head, middle, tail) {
  const headRank = areaTypeRank(getAreaType(head, 'head'));
  const midRank = areaTypeRank(getAreaType(middle, 'middle'));
  const tailRank = areaTypeRank(getAreaType(tail, 'tail'));
  
  if (headRank > midRank || midRank > tailRank) return true;
  if (headRank === midRank && compareArea(head, middle, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(middle, tail, 'middle') > 0) return true;
  return false;
}

/** 识别特殊牌型 */
function getSpecialType(p) {
  const midType = getAreaType(p.middle, 'middle');
  const tailType = getAreaType(p.tail, 'tail');
  if (['铁支', '同花顺'].includes(midType) || ['铁支', '同花顺'].includes(tailType)) {
      return null;
  }
  const all = [...p.head, ...p.middle, ...p.tail];
  const uniqVals = new Set(all.map(c => c.split('_')[0]));
  if (uniqVals.size === 13) return '一条龙';
  const groupedAll = getGroupedValues(all);
  if (groupedAll['2']?.length === 6 && !groupedAll['3'] && !groupedAll['4']) return '六对半';
  if (isFlush(p.head) && isFlush(p.middle) && isFlush(p.tail)) return '三同花';
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

  const groupedA = getGroupedValues(a);
  const groupedB = getGroupedValues(b);

  switch (typeA) {
    case '同花顺': case '顺子': {
      const straightRankA = getStraightRank(a);
      const straightRankB = getStraightRank(b);
      if (straightRankA !== straightRankB) return straightRankA - straightRankB;
      break;
    }
    case '铁支': case '葫芦': case '三条': {
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

  const sortedCardsA = sortCards(a);
  const sortedCardsB = sortCards(b);
  for (let i = 0; i < a.length; ++i) { if (sortedCardsA[i].value !== sortedCardsB[i].value) return sortedCardsA[i].value - sortedCardsB[i].value; }
  for (let i = 0; i < a.length; ++i) { if (sortedCardsA[i].suit !== sortedCardsB[i].suit) return sortedCardsA[i].suit - sortedCardsB[i].suit; }
  return 0;
}


// --- 底层工具函数 ---

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

function areaTypeRank(type) {
  const ranks = { '同花顺': 9, '铁支': 8, '葫芦': 7, '同花': 6, '顺子': 5, '三条': 4, '两对': 3, '对子': 2, '高牌': 1 };
  return ranks[type] || 0;
}

function isStraight(cards) {
  let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a,b) => a-b);
  if (vals.length !== cards.length) return false;
  const isA2345 = JSON.stringify(vals) === JSON.stringify([2,3,4,5,14]);
  return (vals[vals.length - 1] - vals[0] === cards.length - 1) || isA2345;
}

function isFlush(cards) {
  if (!cards || cards.length === 0) return false;
  const firstSuit = cards[0].split('_')[2];
  return cards.every(c => c.split('_')[2] === firstSuit);
}

function getStraightRank(cards) {
    let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a,b) => a-b);
    if (vals.includes(14) && vals.includes(13)) return 14;
    if (vals.includes(14) && vals.includes(2)) return 13.5;
    return vals[vals.length - 1];
}

function getGroupedValues(cards) {
    const counts = {};
    cards.forEach(card => { const val = VALUE_ORDER[card.split('_')[0]]; counts[val] = (counts[val] || 0) + 1; });
    const groups = {};
    for (const val in counts) { const count = counts[val]; if (!groups[count]) groups[count] = []; groups[count].push(Number(val)); }
    for(const count in groups) { groups[count].sort((a,b) => b-a); }
    return groups;
}

function sortCards(cards) {
    return cards.map(cardStr => { const [value, , suit] = cardStr.split('_'); return { value: VALUE_ORDER[value], suit: SUIT_ORDER[suit] }; }).sort((a, b) => b.value - a.value || b.suit - a.suit);
}
