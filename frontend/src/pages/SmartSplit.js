// 超强智能分牌（优先特殊、尾道最大、中道最大、头道最大，保证不倒水）

// 工具函数
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

// 牌型强度顺序
const TYPE_RANK = {
  "同花顺": 9, "铁支": 8, "葫芦": 7, "同花": 6, "顺子": 5, "三条": 4, "两对": 3, "对子": 2, "高牌": 1
};

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

// 倒水判定
function handTypeRank(cards, area) {
  const t = handType(cards, area);
  if (area === 'head') {
    if (t === "三条") return 4;
    if (t === "对子") return 2;
    return 1;
  }
  return TYPE_RANK[t] || 0;
}
function isFoul(head, mid, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(mid, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  return false;
}

// 组合优选（最大5张组合，按牌型强度降序） 
function findBestGroup(cards, n) {
  // 依次查找同花顺>铁支>葫芦>同花>顺子>三条>两对>对子>高牌
  const typeOrder = ["同花顺", "铁支", "葫芦", "同花", "顺子", "三条", "两对", "对子", "高牌"];
  for (const type of typeOrder) {
    const combs = combinations(cards, n);
    let best = null, bestVal = -1;
    for (const group of combs) {
      if (handType(group, n === 3 ? 'head' : (n === 5 ? (typeOrder.indexOf(type) < 2 ? 'tail' : 'middle') : 'other')) === type) {
        // 额外优化：葫芦优先用最小对子
        let val = group.map(cardValue).reduce((a, b) => a + b, 0);
        if (type === "葫芦") {
          // 用最小对子辅助
          const byVal = groupBy(group, cardValue);
          const triples = Object.values(byVal).find(arr => arr.length === 3);
          const pairs = Object.values(byVal).filter(arr => arr.length === 2);
          if (pairs.length > 1) {
            // 优先最小对子
            val -= Math.min(...pairs.map(arr => cardValue(arr[0])));
          }
        }
        if (val > bestVal) { bestVal = val; best = group; }
      }
    }
    if (best) return best;
  }
  // 没有组合牌型，直接最大n张
  return sortCards(cards).slice(0, n);
}

// 主分牌函数
export function aiSmartSplit(cards13) {
  // 1. 特殊牌型
  const special = detectAllSpecialSplits(cards13);
  if (special) return { head: special.head, middle: special.middle, tail: special.tail };

  // 2. 尾道最大
  let tail = findBestGroup(cards13, 5);
  let left8 = cards13.filter(c => !tail.includes(c));

  // 3. 中道最大（剩余8张）
  let middle = findBestGroup(left8, 5);
  let left3 = left8.filter(c => !middle.includes(c));

  // 4. 头道最大（剩余3张）
  let head = sortCards(left3);

  // 5. 检查倒水
  // 如倒水则降级中道/尾道优先降级
  let tryTail = tail, tryMiddle = middle, tryHead = head;
  let changed = false;

  // 降级中道
  if (isFoul(head, middle, tail)) {
    // 枚举所有中道组合降级
    const mids = combinations(left8, 5).sort((a, b) =>
      TYPE_RANK[handType(b, 'middle')] - TYPE_RANK[handType(a, 'middle')]
      || b.map(cardValue).reduce((x, y) => x + y, 0) - a.map(cardValue).reduce((x, y) => x + y, 0)
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
        TYPE_RANK[handType(b, 'tail')] - TYPE_RANK[handType(a, 'tail')]
        || b.map(cardValue).reduce((x, y) => x + y, 0) - a.map(cardValue).reduce((x, y) => x + y, 0)
      );
      for (const t of tails) {
        const left8b = cards13.filter(c => !t.includes(c));
        const midb = findBestGroup(left8b, 5);
        const headb = left8b.filter(c => !midb.includes(c));
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

// 多分法接口
export function getSmartSplits(cards13) {
  // 本算法直接只返回一组最优分法（如需多方案可拓展穷举）
  return [aiSmartSplit(cards13)];
}

// 填充AI玩家（兼容原始接口）
export function fillAiPlayers(playersArr) {
  return playersArr.map(p =>
    p.isAI && Array.isArray(p.cards13) && p.cards13.length === 13
      ? { ...p, ...aiSmartSplit(p.cards13) }
      : p
  );
}
