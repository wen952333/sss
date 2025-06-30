// 最强智能十三水分牌，支持：特殊牌型检测(一条龙/六对半/三顺/三同花)、极限剪枝、智能评分、永不倒水

const SPLIT_ENUM_LIMIT = 3000; // 极限枚举量限制，防卡死

// ========== 特殊牌型检测 ==========
function detectSpecialType(cards13) {
  // 一条龙：13种点全有
  const uniqVals = new Set(cards13.map(c => c.split('_')[0]));
  if (uniqVals.size === 13) {
    const sorted = cards13.slice().sort((a, b) => cardValue(a) - cardValue(b));
    return {
      head: sorted.slice(0, 3),
      middle: sorted.slice(3, 8),
      tail: sorted.slice(8, 13)
    };
  }
  // 六对半
  const valMap = {};
  for (const c of cards13) {
    const v = c.split('_')[0];
    valMap[v] = (valMap[v] || 0) + 1;
  }
  const pairs = Object.values(valMap).filter(c => c === 2).length;
  const triplet = Object.values(valMap).filter(c => c === 3).length;
  if (pairs === 6 && triplet === 0) {
    // 简单平均分配，未必最优
    let all = [...cards13];
    let head = all.splice(0, 3);
    let middle = all.splice(0, 5);
    let tail = all;
    return { head, middle, tail };
  }
  // 三同花
  const suits = {};
  for (const c of cards13) {
    const s = c.split('_')[2];
    suits[s] = suits[s] || [];
    suits[s].push(c);
  }
  const suitGroups = Object.values(suits).filter(g => g.length >= 3);
  if (suitGroups.length >= 3) {
    suitGroups.sort((a, b) => b.length - a.length);
    const head = suitGroups[0].slice(0, 3);
    const mid = suitGroups[1].slice(0, 5);
    const tail = suitGroups[2].slice(0, 5);
    return { head, middle: mid, tail };
  }
  // 三顺子（分三套顺子且全牌用尽）
  const allStraights = findAllStraights(cards13);
  if (allStraights.length >= 3) {
    for (let i = 0; i < allStraights.length; ++i)
      for (let j = i + 1; j < allStraights.length; ++j)
        for (let k = j + 1; k < allStraights.length; ++k) {
          const union = [...allStraights[i], ...allStraights[j], ...allStraights[k]];
          if (new Set(union).size === 13) {
            return {
              head: allStraights[i].slice(0, 3),
              middle: allStraights[j].slice(0, 5),
              tail: allStraights[k].slice(0, 5)
            };
          }
        }
  }
  return null;
}

function findAllStraights(cards) {
  // 返回所有5张顺子组合
  const vals = cards.map(cardValue);
  const uniq = [...new Set(vals)].sort((a, b) => a - b);
  let result = [];
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 1; j < 5; j++) if (uniq[i + j] !== uniq[i] + j) ok = false;
    if (ok) {
      const straightVals = uniq.slice(i, i + 5);
      const straightCards = cards.filter(c => straightVals.includes(cardValue(c)));
      if (straightCards.length >= 5) result.push(straightCards.slice(0, 5));
    }
  }
  // A2345
  if (uniq.includes(14) && uniq.includes(2)) {
    const lowVals = [14, 2, 3, 4, 5];
    if (lowVals.every(v => uniq.includes(v))) {
      const straightCards = cards.filter(c => lowVals.includes(cardValue(c)));
      if (straightCards.length >= 5) result.push(straightCards.slice(0, 5));
    }
  }
  return result;
}

// ========== 主入口 ==========
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 1. 特殊牌型优先
  const special = detectSpecialType(cards13);
  if (special) return [special];
  // 2. 枚举所有合法分法，按综合分值排序，取前5
  let allSplits = generateAllValidSplits(cards13);
  if (!allSplits.length) {
    return [balancedSplit(cards13)];
  }
  allSplits.sort((a, b) => b.score - a.score);
  return allSplits.slice(0, 5).map(s => ({ head: s.head, middle: s.middle, tail: s.tail }));
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

// ========== 智能枚举+剪枝 ==========
function generateAllValidSplits(cards13) {
  let headComb = topHeadCombinations(cards13, 12);
  let tailComb = topTailCombinations(cards13, 14);
  let splits = [];
  let tried = 0;
  let seen = new Set();
  for (const head of headComb) {
    let left10 = cards13.filter(c => !head.includes(c));
    for (const tail of tailComb) {
      if (!tail.every(c => left10.includes(c))) continue;
      let middle = left10.filter(c => !tail.includes(c));
      if (middle.length !== 5) continue;
      const key = [...head, ...middle, ...tail].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      if (isFoul(head, middle, tail)) continue;
      splits.push({
        head, middle, tail,
        score: scoreSplit(head, middle, tail)
      });
      tried++;
      if (tried >= SPLIT_ENUM_LIMIT) break;
    }
    if (tried >= SPLIT_ENUM_LIMIT) break;
  }
  return splits;
}

// 头道三条/对子/高牌优先
function topHeadCombinations(cards, N = 12) {
  let combs = [];
  let byVal = groupByValue(cards);
  for (const v in byVal) if (byVal[v].length >= 3) {
    combs.push(byVal[v].slice(0, 3));
  }
  for (const v in byVal) if (byVal[v].length >= 2) {
    let others = cards.filter(c => !byVal[v].includes(c));
    if (others.length > 0) {
      let rest = others.sort((a, b) => cardValue(b) - cardValue(a));
      combs.push([...byVal[v].slice(0, 2), rest[0]]);
    }
  }
  combs.push(cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 3));
  const keys = new Set();
  combs = combs.filter(c => {
    const k = c.slice().sort().join(',');
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
  combs.sort((a, b) => headScore(a) - headScore(b)).reverse();
  return combs.slice(0, N);
}

// 尾道炸弹/顺子/葫芦/同花优先
function topTailCombinations(cards, N = 14) {
  let combs = [];
  let byVal = groupByValue(cards);
  for (const v in byVal) if (byVal[v].length >= 4) {
    let left = cards.filter(c => !byVal[v].includes(c));
    combs.push([...byVal[v].slice(0, 4), left[0]]);
  }
  let bySuit = groupBySuit(cards);
  for (const s in bySuit) if (bySuit[s].length >= 5) {
    combs.push(bySuit[s].slice(0, 5));
  }
  let straights = findStraights(cards);
  combs.push(...straights);
  for (const t in byVal) if (byVal[t].length >= 3) {
    for (const p in byVal) if (p !== t && byVal[p].length >= 2) {
      combs.push([...byVal[t].slice(0, 3), ...byVal[p].slice(0, 2)]);
    }
  }
  combs.push(cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 5));
  const keys = new Set();
  combs = combs.filter(c => {
    const k = c.slice().sort().join(',');
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
  combs.sort((a, b) => tailScore(a) - tailScore(b)).reverse();
  return combs.slice(0, N);
}

// ========== 评分体系 ==========
function scoreSplit(head, mid, tail) {
  let score =
    handTypeScore(tail, 'tail') * 120 +
    handTypeScore(mid, 'middle') * 16 +
    handTypeScore(head, 'head') * 2;
  const headType = handType(head, 'head');
  if (headType === "三条") score += 30;
  else if (headType === "对子") score += 12;
  else score -= 15;
  const midType = handType(mid, 'middle');
  if (midType === "同花顺") score += 30;
  if (midType === "铁支") score += 32;
  if (midType === "葫芦") score += 18;
  if (midType === "顺子") score += 10;
  if (midType === "三条") score += 5;
  if (midType === "两对") score += 2;
  if (midType === "对子") score -= 5;
  const tailType = handType(tail, 'tail');
  if (tailType === "铁支") score += 45;
  if (tailType === "同花顺") score += 38;
  if (tailType === "葫芦") score += 18;
  if (tailType === "顺子") score += 8;
  if (headType === "高牌" && (midType === "高牌" || tailType === "高牌")) score -= 40;
  score += getTotalValue(head) * 0.5 + getTotalValue(mid) * 0.7 + getTotalValue(tail) * 1.2;
  if (tailType === "铁支" && (midType !== "顺子" && midType !== "同花顺" && midType !== "铁支")) score += 12;
  if (headType === "对子" || headType === "三条") {
    const vals = head.map(card => cardValue(card));
    score += Math.max(...vals) * 1.3;
  }
  return score;
}

function headScore(head) {
  const t = handType(head, 'head');
  return handTypeScore(head, 'head') * 10 + getTotalValue(head) + (t === '三条'?55:t==='对子'?20:0);
}
function tailScore(tail) {
  const t = handType(tail, 'tail');
  return handTypeScore(tail, 'tail') * 20 + getTotalValue(tail) + (t === '铁支'?50:t==='同花顺'?40:0);
}

// ========== 判型/判倒水 ==========
function handTypeScore(cards, area) {
  const t = handType(cards, area);
  switch (t) {
    case "铁支": return 8;
    case "同花顺": return 7;
    case "葫芦": return 6;
    case "同花": return 5;
    case "顺子": return 4;
    case "三条": return 3;
    case "两对": return 2;
    case "对子": return 1;
    case "高牌": return 0;
    default: return 0;
  }
}
function handTypeRank(cards, area) {
  if (area === 'head') {
    const t = handType(cards, area);
    if (t === "三条") return 4;
    if (t === "对子") return 2;
    return 1;
  }
  return handTypeScore(cards, area);
}
function isFoul(head, middle, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(middle, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  return !(headRank <= midRank && midRank <= tailRank);
}
function handType(cards, area) {
  if (!cards || cards.length < 3) return "高牌";
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[2]);
  const uniqVals = Array.from(new Set(vals));
  const uniqSuits = Array.from(new Set(suits));
  if (cards.length === 5) {
    if (Object.values(groupBy(vals)).some(a => a.length === 4)) return "铁支";
    if (uniqSuits.length === 1 && isStraight(vals)) return "同花顺";
    if (Object.values(groupBy(vals)).some(a => a.length === 3) && Object.values(groupBy(vals)).some(a => a.length === 2)) return "葫芦";
    if (uniqSuits.length === 1) return "同花";
    if (isStraight(vals)) return "顺子";
    if (Object.values(groupBy(vals)).some(a => a.length === 3)) return "三条";
    if (Object.values(groupBy(vals)).filter(a => a.length === 2).length === 2) return "两对";
    if (Object.values(groupBy(vals)).some(a => a.length === 2)) return "对子";
    return "高牌";
  }
  if (cards.length === 3) {
    if (uniqVals.length === 1) return "三条";
    if (Object.values(groupBy(vals)).some(a => a.length === 2)) return "对子";
    return "高牌";
  }
  return "高牌";
}
function isStraight(vals) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  let idxs = vals.map(v => order.indexOf(v)).sort((a,b)=>a-b);
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
function groupByValue(cards) {
  const g = {};
  for (const card of cards) {
    const v = cardValue(card);
    g[v] = g[v] || [];
    g[v].push(card);
  }
  return g;
}
function groupBySuit(cards) {
  const g = {};
  for (const card of cards) {
    const s = card.split('_')[2];
    g[s] = g[s] || [];
    g[s].push(card);
  }
  return g;
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
function findStraights(cards) {
  const vals = cards.map(cardValue);
  const uniq = [...new Set(vals)].sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 1; j < 5; j++) if (uniq[i + j] !== uniq[i] + j) ok = false;
    if (ok) {
      const straightVals = uniq.slice(i, i + 5);
      const straightCards = cards.filter(c => straightVals.includes(cardValue(c)));
      if (straightCards.length >= 5) res.push(straightCards.slice(0, 5));
    }
  }
  if (uniq.includes(14) && uniq.includes(2)) {
    const lowVals = [14,2,3,4,5];
    if (lowVals.every(v => uniq.includes(v))) {
      const straightCards = cards.filter(c => lowVals.includes(cardValue(c)));
      if (straightCards.length >= 5) res.push(straightCards.slice(0, 5));
    }
  }
  return res;
}
function balancedSplit(cards) {
  const sorted = [...cards];
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
