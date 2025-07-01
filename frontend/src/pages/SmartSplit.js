// 智能十三水AI分牌 - 按用户新需求优化版
// 1. 特殊牌型优先 2. 尾道最大，葫芦优先小对子 3. 中道不拆对子/三条 4. 绝不倒水

// ==== 常量与工具 ====
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
    let used = new Set();
    let flatPairs = pairs.flat();
    let head = flatPairs.slice(0, 3);
    used = new Set(head);
    let rest = cards13.filter(c => !used.has(c));
    let middle = rest.slice(0, 5), tail = rest.slice(5, 10);
    if (head.length === 3 && middle.length === 5 && tail.length === 5)
      return { head, middle, tail, type: '六对半' };
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

// ==== 牌型判定/倒水 ====
const TYPE_ORDER = ["同花顺", "铁支", "葫芦", "同花", "顺子", "三条", "两对", "对子", "高牌"];
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
function isFoul(head, mid, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(mid, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  if (headRank === midRank && compareArea(head, mid, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(mid, tail, 'middle') > 0) return true;
  return false;
}

// ==== compareArea（同步sssScore.js） ====
function compareArea(a, b, area) {
  const typeA = handType(a, area), typeB = handType(b, area);
  const rankA = handTypeRank(a, area), rankB = handTypeRank(b, area);
  if (rankA !== rankB) return rankA - rankB;

  const groupedA = groupBy(a.map(cardValue)), groupedB = groupBy(b.map(cardValue));
  // 顺子/同花顺比较最大点
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

// ==== 尾道为葫芦，优先三条最大+对子最小 ====
function findBestTailWithMinPair(cards) {
  const combs = combinations(cards, 5);
  let best = null, bestScore = -Infinity;
  for (const group of combs) {
    if (handType(group, 'tail') === "葫芦") {
      const byVal = groupBy(group, cardValue);
      const triples = Object.keys(byVal).find(k => byVal[k].length === 3);
      const pairs = Object.keys(byVal).filter(k => byVal[k].length === 2);
      if (triples && pairs.length === 1) {
        // 三条最大，对子最小优先
        const tripleVal = parseInt(triples, 10);
        const pairVal = parseInt(pairs[0], 10);
        const score = tripleVal * 100 - pairVal; // 三条大优先，对子小优先
        if (score > bestScore) {
          best = group;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

// ==== 中道/头道不拆对子/三条 ====
function findBestGroupNoSplit(cards, n) {
  // 1. 统计对子、三条
  const vals = groupBy(cards, cardValue);
  const pairs = Object.values(vals).filter(arr => arr.length === 2);
  const trips = Object.values(vals).filter(arr => arr.length === 3);

  // 2. 优先不拆组
  let candidates = [];
  let base = [];
  pairs.forEach(arr => { if (base.length + 2 <= n) base = base.concat(arr); });
  trips.forEach(arr => { if (base.length + 3 <= n) base = base.concat(arr); });
  if (base.length === n) candidates.push(base);

  // 2.2 如果不够，再补散牌
  if (candidates.length === 0) {
    let nonSplit = [];
    let used = [];
    pairs.forEach(arr => { if (nonSplit.length + 2 <= n) { nonSplit = nonSplit.concat(arr); used = used.concat(arr); } });
    trips.forEach(arr => { if (nonSplit.length + 3 <= n) { nonSplit = nonSplit.concat(arr); used = used.concat(arr); } });
    let left = cards.filter(c => !used.includes(c));
    candidates.push(nonSplit.concat(left.slice(0, n - nonSplit.length)));
  }

  // 3. 按牌型优先+点数排序
  candidates = candidates.concat(combinations(cards, n));
  candidates = candidates.filter(x => x.length === n);
  candidates.sort((a, b) => {
    const ra = TYPE_ORDER.indexOf(handType(b, n === 3 ? 'head' : 'middle')) - TYPE_ORDER.indexOf(handType(a, n === 3 ? 'head' : 'middle'));
    if (ra !== 0) return ra;
    return getTotalValue(b) - getTotalValue(a);
  });
  return candidates[0];
}

// ==== 尾道最大组合方案 ====
function findBestTail(cards) {
  // 先找炸弹/同花顺/葫芦等，点数大优先
  for (const t of TYPE_ORDER) {
    const combs = combinations(cards, 5);
    let best = null, bestVal = -1;
    for (const group of combs) {
      if (handType(group, 'tail') === t) {
        let val = getTotalValue(group);
        if (val > bestVal) { bestVal = val; best = group; }
      }
    }
    if (best) return best;
  }
  // 没有组合牌型，直接最大5张
  return sortCards(cards).slice(0, 5);
}

// ==== 主分牌流程 ====
export function aiSmartSplit(cards13) {
  // 1. 特殊牌型
  const special = detectAllSpecialSplits(cards13);
  if (special) return { head: special.head, middle: special.middle, tail: special.tail };

  // 2. 尾道最大，优先葫芦最小对子
  let tail = findBestTail(cards13);
  if (handType(tail, 'tail') === "葫芦") {
    const altTail = findBestTailWithMinPair(cards13);
    if (altTail) tail = altTail;
  }
  let left8 = cards13.filter(c => !tail.includes(c));

  // 3. 中道不拆对子/三条
  let middle = findBestGroupNoSplit(left8, 5);
  let left3 = left8.filter(c => !middle.includes(c));

  // 4. 头道最大（不拆对子/三条）
  let head = findBestGroupNoSplit(left3, 3);

  // 5. 检查倒水
  // 若倒水则降级中道或尾道
  let tryTail = tail, tryMiddle = middle, tryHead = head;
  let changed = false;

  if (isFoul(head, middle, tail)) {
    // 降级中道
    const mids = combinations(left8, 5).sort((a, b) =>
      TYPE_ORDER.indexOf(handType(b, 'middle')) - TYPE_ORDER.indexOf(handType(a, 'middle'))
      || getTotalValue(b) - getTotalValue(a)
    );
    for (const mid of mids) {
      const rest3 = left8.filter(c => !mid.includes(c));
      if (!isFoul(rest3, mid, tail)) {
        tryMiddle = mid; tryHead = rest3; changed = true; break;
      }
    }
    // 降级尾道
    if (!changed) {
      const tails = combinations(cards13, 5).sort((a, b) =>
        TYPE_ORDER.indexOf(handType(b, 'tail')) - TYPE_ORDER.indexOf(handType(a, 'tail'))
        || getTotalValue(b) - getTotalValue(a)
      );
      for (const t of tails) {
        const left8b = cards13.filter(c => !t.includes(c));
        const midb = findBestGroupNoSplit(left8b, 5);
        const headb = findBestGroupNoSplit(left8b.filter(c => !midb.includes(c)), 3);
        if (!isFoul(headb, midb, t)) {
          tryTail = t; tryMiddle = midb; tryHead = headb; changed = true; break;
        }
      }
    }
    // 兜底
    if (!changed) {
      tryHead = sortCards(cards13).slice(0, 3);
      tryMiddle = sortCards(cards13).slice(3, 8);
      tryTail = sortCards(cards13).slice(8, 13);
    }
  }
  return { head: tryHead, middle: tryMiddle, tail: tryTail };
}

export function getSmartSplits(cards13) {
  // 只返回一组最优分法（如需多方案可拓展）
  return [aiSmartSplit(cards13)];
}
export function getPlayerSmartSplits(cards13, opts) {
  return getSmartSplits(cards13, opts);
}
export function fillAiPlayers(playersArr) {
  return playersArr.map(p =>
    p.isAI && Array.isArray(p.cards13) && p.cards13.length === 13
      ? { ...p, ...aiSmartSplit(p.cards13) }
      : p
  );
}
