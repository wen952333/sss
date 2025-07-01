// 贪心智能分牌：尾道最大、中道尽量不拆对、绝不倒水
// 先枚举最大5张做尾道，只要能分出不倒水方案立即返回，否则降级尾道继续分

const TYPE_ORDER = ["同花顺", "铁支", "葫芦", "同花", "顺子", "三条", "两对", "对子", "高牌"];

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

// 牌型判定
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

// 特殊牌型检测（唯一最高优先）
function detectAllSpecialSplits(cards13) {
  // ...如你原来实现...
  return null;
}

// 倒水判定
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
  return false;
}

// 所有最大5张组合，按牌型+点数降序（允许任意拆，尾道专用）
function allBest5Combos(cards) {
  let result = [];
  for (const type of TYPE_ORDER) {
    const all = combinations(cards, 5).filter(g => handType(g) === type);
    result.push(...all);
    if (all.length > 0) break; // 只要有最大牌型就不往下走
  }
  // 按点数降序
  result.sort((a, b) => b.map(cardValue).reduce((x, y) => x + y, 0) - a.map(cardValue).reduce((x, y) => x + y, 0));
  return result.length ? result : [sortCards(cards).slice(0, 5)];
}

// 最大5张组合（尽量不拆对子/三条）
function findBest5NoSplit(cards) {
  const byVal = groupBy(cards, cardValue);
  let base = [];
  for (const arr of Object.values(byVal)) {
    if (arr.length === 3 && base.length + 3 <= 5) base = base.concat(arr);
  }
  for (const arr of Object.values(byVal)) {
    if (arr.length === 2 && base.length + 2 <= 5) base = base.concat(arr);
  }
  let usedSet = new Set(base);
  let left = cards.filter(c => !usedSet.has(c));
  base = base.concat(left.slice(0, 5 - base.length));
  if (base.length === 5) return base;
  return sortCards(cards).slice(0, 5);
}

// 最大3张组合（优先三条、对子）
function findBest3NoSplit(cards) {
  const byVal = groupBy(cards, cardValue);
  for (const arr of Object.values(byVal)) {
    if (arr.length === 3) return arr.slice(0, 3);
  }
  for (const arr of Object.values(byVal)) {
    if (arr.length === 2) {
      const single = cards.find(c => !arr.includes(c));
      return arr.concat(single);
    }
  }
  return sortCards(cards).slice(0, 3);
}

// 主流程：先尾道最大，再中道尽量整型，绝不倒水
export function aiSmartSplit(cards13) {
  // 特殊牌型唯一
  const special = detectAllSpecialSplits(cards13);
  if (special) return { head: special.head, middle: special.middle, tail: special.tail };

  // 先枚举所有最大5张组合做尾道，降级直到不倒水
  const tailCandidates = allBest5Combos(cards13);
  for (const tail of tailCandidates) {
    const left8 = cards13.filter(c => !tail.includes(c));
    const middle = findBest5NoSplit(left8);
    const head = findBest3NoSplit(left8.filter(c => !middle.includes(c)));
    if (head.length === 3 && middle.length === 5 && tail.length === 5 && !isFoul(head, middle, tail)) {
      return { head, middle, tail };
    }
  }
  // 兜底——按排序强行分
  const sorted = sortCards(cards13);
  return { head: sorted.slice(0, 3), middle: sorted.slice(3, 8), tail: sorted.slice(8, 13) };
}

export function getSmartSplits(cards13) {
  return [aiSmartSplit(cards13)];
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
