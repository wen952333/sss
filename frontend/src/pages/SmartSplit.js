// 智能十三水AI分牌 - 增强版（绝不倒水，兜底全合法）
// 1. 特殊牌型优先 2. 组合剪枝 3. 评分体系极优 4. 绝不倒水 5. compareArea内置

const SPLIT_ENUM_LIMIT = 6000; // 防极端爆炸
const BEAM_HEAD = 18, BEAM_TAIL = 12;

// 牌面点数与花色
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
function getTotalValue(cards) {
  return cards.reduce((sum, c) => sum + cardValue(c), 0);
}
function uniq(arr) { return [...new Set(arr)]; }
function groupBy(arr, fn = x => x) {
  const g = {}; arr.forEach(x => { const k = fn(x); g[k] = g[k] || []; g[k].push(x); }); return g;
}

// n选k组合
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

// ==== 牌型判定/倒水/评分 ==== 
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
function handTypeScore(cards, area) {
  const t = handType(cards, area);
  switch (t) {
    case "铁支": return 8; case "同花顺": return 7; case "葫芦": return 6; case "同花": return 5; case "顺子": return 4;
    case "三条": return 3; case "两对": return 2; case "对子": return 1; default: return 0;
  }
}
function handTypeRank(cards, area) {
  if (area === 'head') {
    const t = handType(cards, area);
    if (t === "三条") return 4; if (t === "对子") return 2; return 1;
  }
  return handTypeScore(cards, area);
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
function scoreSplit(head, mid, tail, style = 'max') {
  let score =
    handTypeScore(tail, 'tail') * 140 +
    handTypeScore(mid, 'middle') * 18 +
    handTypeScore(head, 'head') * 3;
  const headType = handType(head, 'head');
  if (headType === "三条") score += 38; else if (headType === "对子") score += 15; else score -= 18;
  const midType = handType(mid, 'middle');
  if (midType === "同花顺") score += 35; if (midType === "铁支") score += 42; if (midType === "葫芦") score += 25;
  if (midType === "顺子") score += 13; if (midType === "三条") score += 9; if (midType === "两对") score += 4; if (midType === "对子") score -= 6;
  const tailType = handType(tail, 'tail');
  if (tailType === "铁支") score += 60; if (tailType === "同花顺") score += 52; if (tailType === "葫芦") score += 28; if (tailType === "顺子") score += 15;
  if (headType === "高牌" && (midType === "高牌" || tailType === "高牌")) score -= 55;
  score += getTotalValue(head) * 0.7 + getTotalValue(mid) * 0.9 + getTotalValue(tail) * 1.4;
  if (tailType === "铁支" && (midType !== "顺子" && midType !== "同花顺" && midType !== "铁支")) score += 15;
  if (headType === "对子" || headType === "三条") {
    const vals = head.map(cardValue); score += Math.max(...vals) * 1.5;
  }
  if (isSpecialType(head, mid, tail)) score += 85;
  return score;
}
function isSpecialType(head, mid, tail) {
  const all = [...head, ...mid, ...tail], uniqVals = uniq(all.map(cardValue));
  if (uniqVals.length === 13) return true;
  const cnt = {}; for (const c of all) { const v = cardValue(c); cnt[v] = (cnt[v] || 0) + 1; }
  if (Object.values(cnt).filter(x => x === 2).length === 6) return true;
  const suit = c => cardSuit(c);
  if ([head, mid, tail].every(arr => arr.every(x => suit(x) === suit(arr[0])))) return true;
  if ([head, mid, tail].every(arr => isStraight(arr))) return true;
  return false;
}

// ==== compareArea内置（同步sssScore.js核心） ====
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
    const mainA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === (typeA === "铁支" ? 4 : (typeA === "三条" ? 3 : 2))), 10);
    const mainB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === (typeA === "铁支" ? 4 : (typeA === "三条" ? 3 : 2))), 10);
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

// ==== Beam Search极致智能分法（增强：绝不倒水） ====
export function getSmartSplits(cards13, opts = { style: 'max' }) {
  // 特殊牌型优先
  const special = detectAllSpecialSplits(cards13);
  if (special) return [special];

  let splits = [];
  let tries = 0;

  // 头道剪枝（优先大对/三条/高点）
  const headCandidates = combinations(cards13, 3)
    .map(head => ({ head, score: evalHead(head) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, BEAM_HEAD);

  for (const { head } of headCandidates) {
    const left10 = cards13.filter(c => !head.includes(c));
    // 尾道剪枝（优先炸弹/同花顺/大点）
    const tailCandidates = combinations(left10, 5)
      .map(tail => ({ tail, score: evalTail(tail) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, BEAM_TAIL);

    for (const { tail } of tailCandidates) {
      const mid = left10.filter(c => !tail.includes(c));
      if (mid.length !== 5) continue;
      tries++;
      if (tries > SPLIT_ENUM_LIMIT) break;
      if (isFoul(head, mid, tail)) continue;
      const score = scoreSplit(head, mid, tail, opts.style);
      splits.push({ head, middle: mid, tail, score });
    }
    if (tries > SPLIT_ENUM_LIMIT) break;
  }

  // 全枚举兜底
  if (!splits.length) {
    let fallback = [];
    let tries2 = 0;
    for (const head of combinations(cards13, 3)) {
      const left1 = cards13.filter(c => !head.includes(c));
      for (const mid of combinations(left1, 5)) {
        tries2++; if (tries2 > SPLIT_ENUM_LIMIT * 2) break;
        const tail = left1.filter(c => !mid.includes(c));
        if (tail.length !== 5) continue;
        if (isFoul(head, mid, tail)) continue;
        fallback.push({ head, middle: mid, tail, score: scoreSplit(head, mid, tail, opts.style) });
        if (fallback.length >= 5) break;
      }
      if (tries2 > SPLIT_ENUM_LIMIT * 2 || fallback.length >= 5) break;
    }
    if (fallback.length) splits = fallback;
  }

  // 最终只返回合法分法
  splits = splits.filter(s => !isFoul(s.head, s.middle, s.tail));
  if (!splits.length) {
    // 兜底暴力枚举，保证一定出一组合法分法
    for (const head of combinations(cards13, 3)) {
      const left1 = cards13.filter(c => !head.includes(c));
      for (const mid of combinations(left1, 5)) {
        const tail = left1.filter(c => !mid.includes(c));
        if (tail.length !== 5) continue;
        if (!isFoul(head, mid, tail)) return [{ head, middle: mid, tail }];
      }
    }
    throw new Error('无法分出合法非倒水牌型！');
  }
  splits.sort((a, b) => b.score - a.score);
  return splits.slice(0, 5).map(s => ({ head: s.head, middle: s.middle, tail: s.tail }));
}

export function aiSmartSplit(cards13, opts) {
  const splits = getSmartSplits(cards13, opts);
  return splits[0] || balancedSplit(cards13);
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

// ==== 头道/尾道评分 ====
function evalHead(head) {
  const t = handType(head, 'head');
  let score = 0;
  if (t === "三条") score += 130;
  else if (t === "对子") score += 35;
  else score += 3;
  score += getTotalValue(head) * 1.15;
  return score;
}
function evalTail(tail) {
  const t = handType(tail, 'tail');
  let score = 0;
  if (t === "铁支") score += 240;
  else if (t === "同花顺") score += 190;
  else if (t === "葫芦") score += 130;
  else if (t === "顺子") score += 85;
  else if (t === "同花") score += 60;
  else if (t === "三条") score += 40;
  else if (t === "两对") score += 22;
  else if (t === "对子") score += 7;
  else score += 1;
  score += getTotalValue(tail) * 1.6;
  return score;
}

// ==== 均衡分法 ====
function balancedSplit(cards) {
  const sorted = [...cards];
  return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) };
}

export { isFoul };
