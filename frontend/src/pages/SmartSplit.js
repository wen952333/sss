// 极致无剪枝智能分牌：全枚举，绝不剪枝头道、尾道、任何方案
// 1. 先全枚举13张选3张(head)，再8选5(middle)，剩5为tail，全部穷举
// 2. 只输出所有合法不倒水分法中按最大尾道牌型优先、再中道最大、再头道最大排序的前5个

const MAIN_PRIORITY = ["同花顺", "铁支", "葫芦", "同花", "顺子", "三条"];
const ALL_PRIORITY = [...MAIN_PRIORITY, "两对", "对子", "高牌"];
const SPLIT_ENUM_LIMIT = 100000; // 13C3*10C5=286*252=72072

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
  arr.forEach(x => {
    const k = fn(x); g[k] = g[k] || []; g[k].push(x);
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
  const idx = ALL_PRIORITY.indexOf(t);
  return idx === -1 ? 99 : idx;
}
function isFoul(head, mid, tail) {
  const r = x => handTypePriority(handType(x));
  if (r(head) > r(mid) || r(mid) > r(tail)) return true;
  return false;
}

// 特殊牌型优先
function detectAllSpecialSplits(cards13) {
  const vals = uniq(cards13.map(cardValue));
  if (vals.length === 13) {
    const sorted = [...cards13].sort((a, b) => cardValue(b) - cardValue(a));
    return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13), type: '一条龙' };
  }
  const byVal = groupBy(cards13, cardValue);
  if (Object.values(byVal).filter(g => g.length === 2).length === 6) {
    let pairs = Object.values(byVal).filter(g => g.length === 2).flat();
    return { head: pairs.slice(0, 3), middle: pairs.slice(3, 8), tail: pairs.slice(8, 13), type: '六对半' };
  }
  return null;
}

// 全枚举无剪枝
export function getSmartSplits(cards13) {
  // 特殊牌型优先
  const special = detectAllSpecialSplits(cards13);
  if (special) return [special];

  let results = [];
  let tries = 0;

  // 全枚举3张头道
  const allHeadComb = combinations(cards13, 3);

  for (const head of allHeadComb) {
    const left10 = cards13.filter(c => !head.includes(c));
    // 全枚举中道
    const allMidComb = combinations(left10, 5);
    for (const mid of allMidComb) {
      const tail = left10.filter(c => !mid.includes(c));
      if (tail.length !== 5) continue;
      if (isFoul(head, mid, tail)) continue;
      results.push({
        head, middle: mid, tail,
        pTail: handTypePriority(handType(tail)),
        pMid: handTypePriority(handType(mid)),
        pHead: handTypePriority(handType(head)),
        tailVal: getTotalValue(tail),
        midVal: getTotalValue(mid),
        headVal: getTotalValue(head)
      });
      tries++;
      if (tries > SPLIT_ENUM_LIMIT) break;
    }
    if (tries > SPLIT_ENUM_LIMIT) break;
  }

  // 按尾道最大牌型>点数>中道最大>头道最大排序
  results.sort((a, b) =>
    a.pTail - b.pTail || b.tailVal - a.tailVal ||
    a.pMid - b.pMid || b.midVal - a.midVal ||
    a.pHead - b.pHead || b.headVal - a.headVal
  );

  // 只输出前5个
  if (!results.length) {
    // 均匀分法兜底
    const sorted = [...cards13];
    return [{ head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) }];
  }
  return results.slice(0, 5).map(({ head, middle, tail }) => ({ head, middle, tail }));
}

export function aiSmartSplit(cards13) {
  const splits = getSmartSplits(cards13);
  return splits[0] || { head: cards13.slice(0, 3), middle: cards13.slice(3, 8), tail: cards13.slice(8, 13) };
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
