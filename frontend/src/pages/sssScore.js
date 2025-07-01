/**
 * sssScore.final.simplified.js - 十三水最终版比牌计分器 (极简规则)
 * 同花顺/同花先比最大花色，花色相同则比两手牌最大单张归属
 */

const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
};
const SUIT_ORDER = { spades: 4, hearts: 3, clubs: 2, diamonds: 1 };

const SCORES = {
  HEAD: { '三条': 3 },
  MIDDLE: { '铁支': 8, '同花顺': 10, '葫芦': 2 },
  TAIL: { '铁支': 4, '同花顺': 5 },
  SPECIAL: { '一条龙': 13, '三同花': 4, '三顺子': 4, '六对半': 3 },
};

export function calcSSSAllScores(players) {
  const N = players.length;
  if (N < 2) return new Array(N).fill(0);
  let marks = new Array(N).fill(0);
  const playerInfos = players.map(p => {
    const foul = isFoul(p.head, p.middle, p.tail);
    const specialType = foul ? null : getSpecialType(p);
    return { ...p, isFoul: foul, specialType };
  });

  for (let i = 0; i < N; ++i) {
    for (let j = i + 1; j < N; ++j) {
      const p1 = playerInfos[i];
      const p2 = playerInfos[j];
      let pairScore = 0;
      if (p1.isFoul && !p2.isFoul) pairScore = -calculateTotalBaseScore(p2);
      else if (!p1.isFoul && p2.isFoul) pairScore = calculateTotalBaseScore(p1);
      else if (p1.isFoul && p2.isFoul) pairScore = 0;
      else if (p1.specialType && p2.specialType) pairScore = 0;
      else if (p1.specialType && !p2.specialType) pairScore = SCORES.SPECIAL[p1.specialType] || 0;
      else if (!p1.specialType && p2.specialType) pairScore = -(SCORES.SPECIAL[p2.specialType] || 0);
      else {
        const areas = ['head', 'middle', 'tail'];
        for (const area of areas) {
          const cmp = compareArea(p1[area], p2[area], area);
          if (cmp > 0) pairScore += getAreaScore(p1[area], area);
          else if (cmp < 0) pairScore -= getAreaScore(p2[area], area);
        }
      }
      marks[i] += pairScore;
      marks[j] -= pairScore;
    }
  }
  return marks;
}

function calculateTotalBaseScore(p) {
  if (p.specialType) return SCORES.SPECIAL[p.specialType] || 0;
  return getAreaScore(p.head, 'head') + getAreaScore(p.middle, 'middle') + getAreaScore(p.tail, 'tail');
}

export function isFoul(head, middle, tail) {
  const headRank = areaTypeRank(getAreaType(head, 'head'), 'head');
  const midRank = areaTypeRank(getAreaType(middle, 'middle'), 'middle');
  const tailRank = areaTypeRank(getAreaType(tail, 'tail'), 'tail');
  if (headRank > midRank || midRank > tailRank) return true;
  if (headRank === midRank && compareArea(head, middle, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(middle, tail, 'middle') > 0) return true;
  return false;
}

function getAreaType(cards, area) {
  const grouped = getGroupedValues(cards);
  const isF = isFlush(cards);
  const isS = isStraight(cards);

  if (cards.length === 3) {
    if (grouped[3]) return "三条";
    if (grouped[2]) return "对子";
    return "高牌";
  }
  if (isF && isS) return "同花顺";
  if (grouped[4]) return "铁支";
  if (grouped[3] && grouped[2]) return "葫芦";
  if (isF) return "同花";
  if (isS) return "顺子";
  if (grouped[3]) return "三条";
  if (grouped[2]?.length === 2) return "两对";
  if (grouped[2]) return "对子";
  return "高牌";
}

function areaTypeRank(type, area) {
  if (area === 'head') {
    if (type === "三条") return 4;
    if (type === "对子") return 2;
    return 1;
  }
  if (type === "同花顺") return 9;
  if (type === "铁支") return 8;
  if (type === "葫芦") return 7;
  if (type === "同花") return 6;
  if (type === "顺子") return 5;
  if (type === "三条") return 4;
  if (type === "两对") return 3;
  if (type === "对子") return 2;
  return 1;
}

function getAreaScore(cards, area) {
  const type = getAreaType(cards, area);
  const areaUpper = area.toUpperCase();
  return SCORES[areaUpper]?.[type] || 1;
}

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
  for (const count in groups) {
    groups[count].sort((a, b) => b - a);
  }
  return groups;
}

function isStraight(cards) {
  let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a, b) => a - b);
  if (vals.length !== cards.length) return false;
  const isA2345 = JSON.stringify(vals) === JSON.stringify([2, 3, 4, 5, 14]);
  const isNormalStraight = (vals[vals.length - 1] - vals[0] === cards.length - 1);
  return isNormalStraight || isA2345;
}
function isFlush(cards) {
  if (!cards || cards.length === 0) return false;
  const firstSuit = cards[0].split('_')[2];
  return cards.every(c => c.split('_')[2] === firstSuit);
}

// ======== 核心比牌：同花顺/同花新规则 ========
function compareArea(a, b, area) {
  const typeA = getAreaType(a, area);
  const typeB = getAreaType(b, area);
  const rankA = areaTypeRank(typeA, area);
  const rankB = areaTypeRank(typeB, area);
  if (rankA !== rankB) return rankA - rankB;

  const groupedA = getGroupedValues(a);
  const groupedB = getGroupedValues(b);

  // === 新逻辑：同花顺/同花先比最大花色，再比最大单张归属 ===
  if (
    (typeA === '同花顺' && typeB === '同花顺') ||
    (typeA === '同花' && typeB === '同花')
  ) {
    // 1. 先比最大花色
    const suitA = SUIT_ORDER[a[0].split('_')[2]];
    const suitB = SUIT_ORDER[b[0].split('_')[2]];
    if (suitA !== suitB) return suitA - suitB;

    // 2. 花色相同，比两手牌合集最大单张归属
    const all = [...a, ...b];
    let maxCard = all[0];
    for (const c of all) {
      const [val, , suit] = c.split('_');
      const [maxVal, , maxSuit] = maxCard.split('_');
      const v = VALUE_ORDER[val];
      const vMax = VALUE_ORDER[maxVal];
      if (v > vMax || (v === vMax && SUIT_ORDER[suit] > SUIT_ORDER[maxSuit]))
        maxCard = c;
    }
    if (a.includes(maxCard)) return 1;
    if (b.includes(maxCard)) return -1;
    return 0;
  }

  // 顺子/同花顺先比点数
  if (typeA === '顺子' || typeA === '同花顺') {
    const straightRankA = getStraightRank(a), straightRankB = getStraightRank(b);
    if (straightRankA !== straightRankB) return straightRankA - straightRankB;
  }

  // 铁支/三条/对子
  if (["铁支", "三条", "对子"].includes(typeA)) {
    const mainA = groupedA[typeA === '铁支' ? 4 : typeA === '三条' ? 3 : 2][0];
    const mainB = groupedB[typeA === '铁支' ? 4 : typeA === '三条' ? 3 : 2][0];
    if (mainA !== mainB) return mainA - mainB;
    const subA = a.map(c => VALUE_ORDER[c.split('_')[0]]).filter(v => v !== mainA).sort((x, y) => y - x);
    const subB = b.map(c => VALUE_ORDER[c.split('_')[0]]).filter(v => v !== mainB).sort((x, y) => y - x);
    for (let i = 0; i < subA.length; ++i) {
      if (subA[i] !== subB[i]) return subA[i] - subB[i];
    }
    return 0;
  }

  // 葫芦
  if (typeA === '葫芦') {
    const tripleA = groupedA[3][0], tripleB = groupedB[3][0];
    if (tripleA !== tripleB) return tripleA - tripleB;
    const pairA = groupedA[2][0], pairB = groupedB[2][0];
    if (pairA !== pairB) return pairA - pairB;
    return 0;
  }

  // 两对
  if (typeA === '两对') {
    const pairsA = groupedA[2], pairsB = groupedB[2];
    if (pairsA[0] !== pairsB[0]) return pairsA[0] - pairsB[0];
    if (pairsA[1] !== pairsB[1]) return pairsA[1] - pairsB[1];
    const subA = groupedA[1] ? groupedA[1][0] : 0, subB = groupedB[1] ? groupedB[1][0] : 0;
    if (subA !== subB) return subA - subB;
    return 0;
  }

  // 同花
  if (typeA === '同花') {
    const sortedA = sortCards(a), sortedB = sortCards(b);
    for (let i = 0; i < sortedA.length; ++i) {
      if (sortedA[i].value !== sortedB[i].value) return sortedA[i].value - sortedB[i].value;
    }
    for (let i = 0; i < sortedA.length; ++i) {
      if (sortedA[i].suit !== sortedB[i].suit) return sortedA[i].suit - sortedB[i].suit;
    }
    return 0;
  }

  // 其它类型
  const sortedA = sortCards(a), sortedB = sortCards(b);
  for (let i = 0; i < sortedA.length; ++i) {
    if (sortedA[i].value !== sortedB[i].value) return sortedA[i].value - sortedB[i].value;
  }
  for (let i = 0; i < sortedA.length; ++i) {
    if (sortedA[i].suit !== sortedB[i].suit) return sortedA[i].suit - sortedB[i].suit;
  }
  return 0;
}

function sortCards(cards) {
  return cards.map(cardStr => {
    const [value, , suit] = cardStr.split('_');
    return { value: VALUE_ORDER[value], suit: SUIT_ORDER[suit] };
  }).sort((a, b) => b.value - a.value || b.suit - a.suit);
}

function getStraightRank(cards) {
  let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a, b) => a - b);
  if (vals.includes(14) && vals.includes(13)) return 14;
  if (vals.includes(14) && vals.includes(2)) return 13.5;
  return vals[vals.length - 1];
}

function getSpecialType(p) {
  const midType = getAreaType(p.middle, 'middle');
  const tailType = getAreaType(p.tail, 'tail');
  if (['铁支', '同花顺'].includes(midType) || ['铁支', '同花顺'].includes(tailType)) return null;
  const all = [...p.head, ...p.middle, ...p.tail];
  const uniqVals = new Set(all.map(c => c.split('_')[0]));
  if (uniqVals.size === 13) return '一条龙';
  const groupedAll = getGroupedValues(all);
  if (groupedAll['2']?.length === 6 && !groupedAll['3'] && !groupedAll['4']) return '六对半';
  if (isFlush(p.head) && isFlush(p.middle) && isFlush(p.tail)) return '三同花';
  if (isStraight(p.head) && isStraight(p.middle) && isStraight(p.tail)) return '三顺子';
  return null;
}
