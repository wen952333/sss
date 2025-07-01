// 高效智能分牌 - 快速尾道优先+特殊牌型识别+至少3种分法兜底
// 1. 特殊牌型优先 2. 尾道最大优先，智能剪枝 3. 不倒水 4. 保证至少3种分法

const MAIN_PRIORITY = ["同花顺","铁支","葫芦","同花","顺子","三条","两对","对子","高牌"];
const BEAM_TAIL = 18;
const BEAM_MID = 9;
const SPLIT_ENUM_LIMIT = 16000;

function cardValue(card) {
  const v = card.split('_')[0];
  if (v === 'ace') return 14;
  if (v === 'king') return 13;
  if (v === 'queen') return 12;
  if (v === 'jack') return 11;
  return parseInt(v, 10);
}
function cardSuit(card) { return card.split('_')[2]; }
function uniq(arr) { return [...new Set(arr)]; }
function getTotalValue(cards) { return cards.reduce((s, c) => s + cardValue(c), 0); }
function groupBy(arr, fn = x => x) {
  const g = {};
  arr.forEach(x => { const k = fn(x); g[k] = g[k] || []; g[k].push(x); });
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

// ---- 牌型判定 ----
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
function handType(cards) {
  if (!cards || cards.length < 3) return "高牌";
  const vals = cards.map(cardValue), suits = cards.map(cardSuit), uniqVals = uniq(vals), uniqSuits = uniq(suits);
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
function handTypePriority(t) {
  const idx = MAIN_PRIORITY.indexOf(t);
  return idx === -1 ? 99 : idx;
}
function isFoul(head, mid, tail) {
  const r = x => handTypePriority(handType(x));
  if (r(head) > r(mid) || r(mid) > r(tail)) return true;
  return false;
}

// ---- 比牌规则中的特殊牌型识别 ----
function detectAllSpecialSplits(cards13) {
  // 一条龙
  const vals = uniq(cards13.map(cardValue));
  if (vals.length === 13) {
    const sorted = [...cards13].sort((a, b) => cardValue(b) - cardValue(a));
    return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13), type: '一条龙' };
  }
  // 六对半
  const byVal = groupBy(cards13, cardValue);
  if (Object.values(byVal).filter(g => g.length === 2).length === 6) {
    let pairs = Object.values(byVal).filter(g => g.length === 2).flat();
    return { head: pairs.slice(0, 3), middle: pairs.slice(3, 8), tail: pairs.slice(8, 13), type: '六对半' };
  }
  // 三同花
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
  // 三顺子
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

// ---- 智能分牌核心 ----
export function getSmartSplits(cards13, opts={style:'max'}) {
  // 1. 特殊牌型优先
  const special = detectAllSpecialSplits(cards13);
  if (special) return [special];

  let results = [];
  let tries = 0;

  // 2. 尾道优先剪枝
  let allTailComb = combinations(cards13, 5)
    .map(cards => ({ cards, type: handType(cards), prio: handTypePriority(handType(cards)), val: getTotalValue(cards) }))
    .sort((a, b) => a.prio - b.prio || b.val - a.val)
    .slice(0, BEAM_TAIL);

  for (const tailObj of allTailComb) {
    const tail = tailObj.cards;
    const left8 = cards13.filter(c => !tail.includes(c));
    // 3. 中道剪枝
    let allMidComb = combinations(left8, 5)
      .map(cards => ({ cards, type: handType(cards), prio: handTypePriority(handType(cards)), val: getTotalValue(cards) }))
      .sort((a, b) => a.prio - b.prio || b.val - a.val)
      .slice(0, BEAM_MID);

    for (const midObj of allMidComb) {
      const mid = midObj.cards;
      const head = left8.filter(c => !mid.includes(c));
      if (head.length !== 3) continue;
      if (isFoul(head, mid, tail)) continue;
      results.push({ head, middle: mid, tail });
      tries++;
      if (results.length >= 8 || tries > SPLIT_ENUM_LIMIT) break;
    }
    if (results.length >= 8 || tries > SPLIT_ENUM_LIMIT) break;
  }

  // 4. 按最大尾道、中道、头道排序，保证前N个不全重复
  let uniqSet = new Set(), uniqResults = [];
  for (const r of results) {
    const key = [...r.head, ...r.middle, ...r.tail].join('|');
    if (!uniqSet.has(key)) {
      uniqSet.add(key);
      uniqResults.push(r);
    }
    if (uniqResults.length >= 5) break;
  }

  // 5. 兜底：保证至少3种分法
  while (uniqResults.length < 3) {
    uniqResults.push(balancedSplit(cards13));
  }

  return uniqResults.slice(0, 5);
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

// ---- 均衡兜底分法 ----
function balancedSplit(cards) {
  const sorted = [...cards];
  return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) };
}
