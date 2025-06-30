// 最强智能十三水分牌，兼容后端倒水判定、特殊牌型、奖励、极限分法，且永不倒水

const SPLIT_ENUM_LIMIT = 3000; // 枚举上限，防卡死

// ---------- 特殊牌型检测 ----------
function detectSpecialType(cards13) {
  // 一条龙
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
  const pairs = Object.values(valMap).filter(cnt => cnt === 2).length;
  const triplet = Object.values(valMap).filter(cnt => cnt === 3).length;
  if (pairs === 6 && triplet === 0) {
    // 尝试把6对平均分三墩
    const pairsArr = [];
    for (const v in valMap) if (valMap[v] === 2) {
      pairsArr.push(cards13.filter(c => c.split('_')[0] === v));
    }
    let used = [];
    let head = [], middle = [], tail = [];
    // 头道一对+1单，中、尾各两对+1单
    head = [...pairsArr[0], pairsArr[1][0]];
    middle = [pairsArr[1][1], ...pairsArr[2], ...pairsArr[3]].flat().slice(0, 5);
    tail = [pairsArr[4], pairsArr[5]].flat();
    const rest = cards13.filter(c => !head.includes(c) && !middle.includes(c) && !tail.includes(c));
    // 补齐
    while (middle.length < 5 && rest.length) middle.push(rest.shift());
    while (tail.length < 5 && rest.length) tail.push(rest.shift());
    return { head, middle, tail };
  }
  // 三同花
  const suits = {};
  for (const c of cards13) {
    const s = c.split('_')[2];
    suits[s] = (suits[s] || []);
    suits[s].push(c);
  }
  const suitGroups = Object.values(suits).filter(g => g.length >= 3);
  if (suitGroups.length >= 3) {
    // 头中尾各分一个同花
    suitGroups.sort((a, b) => b.length - a.length);
    const head = suitGroups[0].slice(0, 3);
    const mid = suitGroups[1].slice(0, 5);
    const tail = suitGroups[2].slice(0, 5);
    return { head, middle: mid, tail };
  }
  // 三顺子（只要能分三套顺子，且全牌用尽）
  const allStraights = findAllStraights(cards13);
  if (allStraights.length >= 3) {
    // 穷举三套顺子的组合
    for (let i = 0; i < allStraights.length; ++i)
      for (let j = i + 1; j < allStraights.length; ++j)
        for (let k = j + 1; k < allStraights.length; ++k) {
          const union = [...allStraights[i], ...allStraights[j], ...allStraights[k]];
          if (new Set(union).size === 13) {
            // 分配头/中/尾
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

// =========== 分牌主流程 ===========
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

function generateAllValidSplits(cards13) {
  // 多重剪枝：头道优先三条/对子/高牌，尾道优先炸弹/葫芦/顺子/同花
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

// 头道组合优先级
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
// 尾道组合优先级
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

/** ----- 评分体系 ----- **/
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
  // 特殊牌型加权
  if (isSpecialType(head, mid, tail, [...head, ...mid, ...tail])) score += 1000;
  return score;
}

function isSpecialType(head, mid, tail, all) {
  // 一条龙/三同花/三顺子/六对半
  const uniqVals = new Set(all.map(c => c.split('_')[0]));
  if (uniqVals.size === 13) return true;
  const cnt = {};
  for (const c of all) cnt[c.split('_')[0]] = (cnt[c.split('_')[0]] || 0) + 1;
  if (Object.values(cnt).filter(v => v === 2).length === 6 && !Object.values(cnt).includes(3) && !Object.values(cnt).includes(4)) return true;
  const suits = {};
  for (const c of all) {
    const s = c.split('_')[2];
    suits[s] = (suits[s] || []);
    suits[s].push(c);
  }
  if (Object.values(suits).filter(g => g.length >= 3).length >= 3) return true;
  if (isStraight(head.map(cardValue)) && isStraight(mid.map(cardValue)) && isStraight(tail.map(cardValue))) return true;
  return false;
}

/** ----- 牌型判定与分数 ----- **/
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
