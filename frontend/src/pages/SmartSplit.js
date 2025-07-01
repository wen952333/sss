// 极致智能分牌 - 严格最大牌力、葫芦优先小对子、不拆对三条、绝不倒水、每一分法都可选

// ==== 工具函数 ====
const TYPE_ORDER = ["同花顺", "铁支", "葫芦", "同花", "顺子", "三条", "两对", "对子", "高牌"];
function cardValue(card) {
  const v = card.split('_')[0];
  if (v === 'ace') return 14;
  if (v === 'king') return 13;
  if (v === 'queen') return 12;
  if (v === 'jack') return 11;
  return parseInt(v, 10);
}
function cardSuit(card) {
  return card.split('_')[2];
}
function uniq(arr) { return [...new Set(arr)]; }
function groupBy(arr, fn = x => x) {
  const g = {};
  arr.forEach(x => {
    const k = fn(x);
    g[k] = g[k] || [];
    g[k].push(x);
  });
  return g;
}
function combinations(arr, k) {
  let res = [];
  function comb(path, start) {
    if (path.length === k) return res.push(path);
    for (let i = start; i < arr.length; ++i) comb([...path, arr[i]], i + 1);
  }
  comb([], 0);
  return res;
}
function sortCards(cards) {
  return [...cards].sort((a, b) => cardValue(b) - cardValue(a) || cardSuit(b).localeCompare(cardSuit(a)));
}
function getTotalValue(cards) {
  return cards.reduce((sum, c) => sum + cardValue(c), 0);
}

// ==== 牌型判定/倒水 ====
function isStraight(cards) {
  const vals = uniq(cards.map(cardValue)).sort((a, b) => a - b);
  if (vals.length !== cards.length) return false;
  for (let i = 1; i < vals.length; ++i) if (vals[i] !== vals[i - 1] + 1) return false;
  if (vals.includes(14) && vals[0] === 2 && vals[1] === 3) {
    const t = vals.slice(); t[t.indexOf(14)] = 1; t.sort((a, b) => a - b);
    for (let i = 1; i < t.length; ++i) if (t[i] !== t[i - 1] + 1) return false;
    return true;
  }
  return true;
}
function isFlush(cards) {
  if (!cards.length) return false;
  const suit = cardSuit(cards[0]);
  return cards.every(c => cardSuit(c) === suit);
}
function handType(cards, area) {
  if (!cards || cards.length < 3) return "高牌";
  const vals = cards.map(cardValue), suits = cards.map(cardSuit),
    uniqVals = uniq(vals), uniqSuits = uniq(suits);
  if (cards.length === 5) {
    if (Object.values(groupBy(vals)).some(a => a.length === 4)) return "铁支";
    if (uniqSuits.length === 1 && isStraight(cards)) return "同花顺";
    if (Object.values(groupBy(vals)).some(a => a.length === 3) && Object.values(groupBy(vals)).some(a => a.length === 2)) return "葫芦";
    if (uniqSuits.length === 1) return "同花";
    if (isStraight(cards)) return "顺子";
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
function handTypeRank(cards, area) {
  const t = handType(cards, area);
  if (area === 'head') {
    if (t === "三条") return 4;
    if (t === "对子") return 2;
    return 1;
  }
  return TYPE_ORDER.indexOf(t) + 1;
}
function compareArea(a, b, area) {
  const typeA = handType(a, area), typeB = handType(b, area);
  const rankA = handTypeRank(a, area), rankB = handTypeRank(b, area);
  if (rankA !== rankB) return rankA - rankB;
  const groupedA = groupBy(a.map(cardValue)), groupedB = groupBy(b.map(cardValue));
  // 顺子/同花顺
  if ((typeA === "顺子" || typeA === "同花顺")) {
    const valsA = a.map(cardValue).sort((a, b) => a - b), valsB = b.map(cardValue).sort((a, b) => a - b);
    const maxA = valsA[valsA.length - 1], maxB = valsB[valsB.length - 1];
    if (maxA !== maxB) return maxA - maxB;
  }
  // 铁支/三条/对子
  if (["铁支", "三条", "对子"].includes(typeA)) {
    const mainA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === (typeA === "铁支" ? 4 : typeA === "三条" ? 3 : 2)), 10);
    const mainB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === (typeA === "铁支" ? 4 : typeA === "三条" ? 3 : 2)), 10);
    if (mainA !== mainB) return mainA - mainB;
    const subA = a.map(cardValue).filter(v => v !== mainA).sort((x, y) => y - x);
    const subB = b.map(cardValue).filter(v => v !== mainB).sort((x, y) => y - x);
    for (let i = 0; i < subA.length; ++i) if (subA[i] !== subB[i]) return subA[i] - subB[i];
    return 0;
  }
  // 葫芦
  if (typeA === "葫芦") {
    const tripleA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === 3), 10);
    const tripleB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === 3), 10);
    if (tripleA !== tripleB) return tripleA - tripleB;
    const pairA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === 2), 10);
    const pairB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === 2), 10);
    if (pairA !== pairB) return pairA - pairB;
    return 0;
  }
  // 两对
  if (typeA === "两对") {
    const pairsA = Object.keys(groupedA).filter(k => groupedA[k].length === 2).map(Number).sort((a, b) => b - a);
    const pairsB = Object.keys(groupedB).filter(k => groupedB[k].length === 2).map(Number).sort((a, b) => b - a);
    if (pairsA[0] !== pairsB[0]) return pairsA[0] - pairsB[0];
    if (pairsA[1] !== pairsB[1]) return pairsA[1] - pairsB[1];
    const subA = Object.keys(groupedA).find(k => groupedA[k].length === 1), subB = Object.keys(groupedB).find(k => groupedB[k].length === 1);
    if (subA && subB && subA !== subB) return subA - subB;
    return 0;
  }
  // 同花
  if (typeA === "同花") {
    const valsA = a.map(cardValue).sort((a, b) => b - a), valsB = b.map(cardValue).sort((a, b) => b - a);
    for (let i = 0; i < valsA.length; ++i) if (valsA[i] !== valsB[i]) return valsA[i] - valsB[i];
    return 0;
  }
  // 高牌
  const valsA = a.map(cardValue).sort((a, b) => b - a), valsB = b.map(cardValue).sort((a, b) => b - a);
  for (let i = 0; i < valsA.length; ++i) if (valsA[i] !== valsB[i]) return valsA[i] - valsB[i];
  return 0;
}
function isFoul(head, mid, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(mid, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  if (headRank === midRank && compareArea(head, mid, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(mid, tail, 'middle') > 0) return true;
  return false;
}

// ==== 特殊牌型检测 ====
function detectDragon(cards13) {
  const vals = uniq(cards13.map(cardValue));
  if (vals.length === 13) {
    const sorted = sortCards(cards13);
    return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13), type: '一条龙' };
  }
  return null;
}
function detectSixPairs(cards13) {
  const byVal = groupBy(cards13, cardValue);
  const pairs = Object.values(byVal).filter(g => g.length === 2);
  if (pairs.length === 6) {
    let head = pairs[0].concat(pairs[1][0]);
    let used = new Set(head), rest = cards13.filter(c => !used.has(c));
    let mid = pairs[1].slice(1).concat(pairs[2], pairs[3][0]);
    used = new Set([...head, ...mid]);
    let tail = cards13.filter(c => !used.has(c));
    if (head.length === 3 && mid.length === 5 && tail.length === 5)
      return { head, middle: mid, tail, type: '六对半' };
  }
  return null;
}
function detectThreeStraight(cards13) {
  const comb3 = combinations(cards13, 3);
  for (const head of comb3) {
    if (!isStraight(head)) continue;
    const left10 = cards13.filter(c => !head.includes(c));
    for (const mid of combinations(left10, 5)) {
      if (!isStraight(mid)) continue;
      const tail = left10.filter(c => !mid.includes(c));
      if (!isStraight(tail)) continue;
      return { head, middle: mid, tail, type: '三顺子' };
    }
  }
  return null;
}
function detectThreeFlush(cards13) {
  const comb3 = combinations(cards13, 3);
  for (const head of comb3) {
    if (!isFlush(head)) continue;
    const left10 = cards13.filter(c => !head.includes(c));
    for (const mid of combinations(left10, 5)) {
      if (!isFlush(mid)) continue;
      const tail = left10.filter(c => !mid.includes(c));
      if (!isFlush(tail)) continue;
      return { head, middle: mid, tail, type: '三同花' };
    }
  }
  return null;
}
function detectAllSpecialSplits(cards13) {
  return detectDragon(cards13)
    || detectSixPairs(cards13)
    || detectThreeStraight(cards13)
    || detectThreeFlush(cards13)
    || null;
}

// ==== 最大尾道所有组合（葫芦三条最大对子最小） ====
function enumerateBest5Combos(cards) {
  for (const t of TYPE_ORDER) {
    let res = [];
    for (const group of combinations(cards, 5)) {
      if (handType(group) === t) res.push(group);
    }
    if (t === '葫芦' && res.length > 1) {
      res.sort((a, b) => {
        const grA = groupBy(a, cardValue), grB = groupBy(b, cardValue);
        const tripleA = parseInt(Object.keys(grA).find(k => grA[k].length === 3), 10);
        const tripleB = parseInt(Object.keys(grB).find(k => grB[k].length === 3), 10);
        if (tripleA !== tripleB) return tripleB - tripleA;
        const pairA = parseInt(Object.keys(grA).find(k => grA[k].length === 2), 10);
        const pairB = parseInt(Object.keys(grB).find(k => grB[k].length === 2), 10);
        return pairA - pairB;
      });
    }
    if (res.length > 0) return res;
  }
  return [sortCards(cards).slice(0, 5)];
}

// ==== 中道最大组合（不拆对/三条，点数最大）====
function enumerateBest5CombosNoSplit(cards) {
  // 1. 所有最大牌型
  for (const t of TYPE_ORDER) {
    let res = [];
    for (const group of combinations(cards, 5)) {
      if (handType(group) === t) {
        // 不拆对三条
        const byVal = groupBy(cards, cardValue);
        let ok = true;
        for (const k in byVal) {
          if (byVal[k].length === 2 && group.filter(c => cardValue(c) === Number(k)).length === 1) ok = false;
          if (byVal[k].length === 3 && group.filter(c => cardValue(c) === Number(k)).length < 2) ok = false;
        }
        if (ok) res.push(group);
      }
    }
    if (res.length > 0) return res;
  }
  // 2. 没法整型牌型，直接最大5张
  return [sortCards(cards).slice(0, 5)];
}

// ==== 头道最大组合（不拆对/三条）====
function enumerateBest3CombosNoSplit(cards) {
  // 三条>对子>高牌
  const types = ['三条', '对子', '高牌'];
  for (const t of types) {
    let res = [];
    for (const group of combinations(cards, 3)) {
      if (handType(group, 'head') === t) {
        // 不拆对三条
        const byVal = groupBy(cards, cardValue);
        let ok = true;
        for (const k in byVal) {
          if (byVal[k].length === 2 && group.filter(c => cardValue(c) === Number(k)).length === 1) ok = false;
          if (byVal[k].length === 3 && group.filter(c => cardValue(c) === Number(k)).length < 2) ok = false;
        }
        if (ok) res.push(group);
      }
    }
    if (res.length > 0) return res;
  }
  return [sortCards(cards).slice(0, 3)];
}

// ==== 主分牌流程 ====
export function getSmartSplits(cards13) {
  // 特殊牌型优先
  const special = detectAllSpecialSplits(cards13);
  if (special) return [special];

  let splits = [];
  // 1. 枚举所有最大尾道组合
  const tailCombos = enumerateBest5Combos(cards13);
  for (const tail of tailCombos) {
    const left8 = cards13.filter(c => !tail.includes(c));
    // 2. 枚举所有最大中道（不拆对/三条）
    const midCombos = enumerateBest5CombosNoSplit(left8);
    for (const middle of midCombos) {
      const left3 = left8.filter(c => !middle.includes(c));
      if (left3.length !== 3) continue;
      // 3. 头道最大组合（不拆对/三条）
      const headCombos = enumerateBest3CombosNoSplit(left3);
      for (const head of headCombos) {
        if (!isFoul(head, middle, tail)) {
          splits.push({ head, middle, tail });
        }
      }
    }
  }
  if (!splits.length) {
    const sorted = sortCards(cards13);
    splits.push({ head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) });
  }
  return splits;
}

export function aiSmartSplit(cards13) {
  const splits = getSmartSplits(cards13);
  return splits[0];
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
