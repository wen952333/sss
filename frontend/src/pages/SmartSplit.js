// 极致智能分牌：先选尾道最大5张组合，再选中道最大5张组合，剩下3张做头道，绝不倒水，不剪枝头道！

const PRIORITY = ["同花顺","铁支","葫芦","同花","顺子","三条"];
const ALL_PRIORITY = [...PRIORITY, "两对", "对子", "高牌"];
const SPLIT_ENUM_LIMIT = 8000;

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

// 极致尾道最大优先智能分法，绝不剪头道
export function getSmartSplits(cards13) {
  // 特殊牌优先
  const special = detectAllSpecialSplits(cards13);
  if (special) return [special];

  let results = [];
  let tries = 0;

  // 1. 先找最大优先级尾道
  let allTailComb = combinations(cards13, 5)
    .map(cards => ({ cards, type: handType(cards) }))
    .filter(x => PRIORITY.includes(x.type))
    .sort((a, b) => {
      const pa = handTypePriority(a.type), pb = handTypePriority(b.type);
      if (pa !== pb) return pa - pb;
      return getTotalValue(b.cards) - getTotalValue(a.cards);
    });

  for (const tailObj of allTailComb) {
    if (tries > SPLIT_ENUM_LIMIT) break;
    const tail = tailObj.cards;
    const left8 = cards13.filter(c => !tail.includes(c));
    // 2. 剩下8张同理，最大优先级中道
    let allMidComb = combinations(left8, 5)
      .map(cards => ({ cards, type: handType(cards) }))
      .filter(x => PRIORITY.includes(x.type))
      .sort((a, b) => {
        const pa = handTypePriority(a.type), pb = handTypePriority(b.type);
        if (pa !== pb) return pa - pb;
        return getTotalValue(b.cards) - getTotalValue(a.cards);
      });

    let found = false;
    for (const midObj of allMidComb) {
      const mid = midObj.cards;
      const head = left8.filter(c => !mid.includes(c));
      if (head.length !== 3) continue;
      if (isFoul(head, mid, tail)) continue;
      results.push({ head, middle: mid, tail });
      found = true;
      break; // 只要最大中道
    }
    // 如果8张组不出同花顺~三条，则头道自动最大（对子/三条/高牌），剩下5张做中道
    if (!found) {
      let allHeadComb = combinations(left8, 3)
        .map(cards => ({ cards, type: handType(cards) }))
        .sort((a, b) => handTypePriority(a.type) - handTypePriority(b.type) || getTotalValue(b.cards) - getTotalValue(a.cards));
      for (const headObj of allHeadComb) {
        const head = headObj.cards;
        const mid = left8.filter(c => !head.includes(c));
        if (mid.length !== 5) continue;
        if (isFoul(head, mid, tail)) continue;
        results.push({ head, middle: mid, tail });
        break;
      }
    }
    if (results.length >= 5) break;
    tries++;
  }

  if (!results.length) {
    // 均匀分法兜底
    const sorted = [...cards13];
    return [{ head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) }];
  }
  return results.slice(0, 5);
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
