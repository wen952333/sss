// 超强智能分牌（尾道最大可任意拆，中道优先不拆对，头道最大）
// 特殊牌型最优先，其次依次按十三水比牌规则依次贪心分牌

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

// 特殊牌型检测
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
    let flatPairs = pairs.flat();
    let head = flatPairs.slice(0, 3);
    let used = new Set(head);
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

// 最大5张组合（允许任意拆牌）
function findBest5Combo(cards) {
  for (const type of TYPE_ORDER) {
    let best = null;
    let bestVal = -1;
    for (const group of combinations(cards, 5)) {
      if (handType(group) === type) {
        // 葫芦三条最大对子最小
        let val = group.map(cardValue).reduce((a, b) => a + b, 0);
        if (type === "葫芦") {
          const byVal = groupBy(group, cardValue);
          const triples = Object.values(byVal).find(arr => arr.length === 3);
          const pairs = Object.values(byVal).filter(arr => arr.length === 2);
          if (pairs.length > 1) {
            val -= Math.min(...pairs.map(arr => cardValue(arr[0])));
          }
        }
        if (val > bestVal) { bestVal = val; best = group; }
      }
    }
    if (best) return best;
  }
  return sortCards(cards).slice(0, 5);
}

// 最大5张组合（尽量不拆对子/三条）
function findBest5NoSplit(cards) {
  // 统计对子/三条
  const vals = groupBy(cards, cardValue);
  let base = [];
  // 优先整三条
  for (const arr of Object.values(vals)) {
    if (arr.length === 3 && base.length + 3 <= 5) base = base.concat(arr);
  }
  // 其次整对子
  for (const arr of Object.values(vals)) {
    if (arr.length === 2 && base.length + 2 <= 5) base = base.concat(arr);
  }
  // 不足补散牌
  let usedSet = new Set(base);
  let left = cards.filter(c => !usedSet.has(c));
  base = base.concat(left.slice(0, 5 - base.length));
  if (base.length === 5) return base;
  // 实在不够，直接最大5张
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

// 主流程
export function getSmartSplits(cards13) {
  // 1. 特殊牌型优先
  const special = detectAllSpecialSplits(cards13);
  if (special) return [special];

  // 2. 先选最大5张做尾道（允许任意拆）
  const tail = findBest5Combo(cards13);

  // 3. 剩下8张，最大组合且尽量不拆对子三条
  const left8 = cards13.filter(c => !tail.includes(c));
  const middle = findBest5NoSplit(left8);

  // 4. 剩3张，最大头道
  const head = findBest3NoSplit(left8.filter(c => !middle.includes(c)));

  // 5. 检查倒水，不倒水就返回
  if (!isFoul(head, middle, tail)) {
    return [{ head, middle, tail }];
  }
  // 兜底
  const sorted = sortCards(cards13);
  return [{
    head: sorted.slice(0, 3),
    middle: sorted.slice(3, 8),
    tail: sorted.slice(8, 13)
  }];
}

export function aiSmartSplit(cards13) {
  return getSmartSplits(cards13)[0];
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
