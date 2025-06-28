// 更智能的十三水分牌与AI补位模块 v2

/**
 * 返回最优分法，优先级：
 * 1. 尾道能成炸弹/葫芦/同花顺/顺子优先
 * 2. 中道能成三条/葫芦/顺子优先
 * 3. 头道三条>对子>高牌
 * 4. 头<中<尾
 */

export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 生成所有可能的分法，按综合分值排序，取前5
  let allSplits = generateAllValidSplits(cards13);
  if (!allSplits.length) {
    // 回退为简单均匀分法
    return [balancedSplit(cards13)];
  }
  // 按分数高低排序，取前5
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

//----------------- 核心智能分牌算法 -----------------//

// 生成所有合理分法，并为每个分法打分
function generateAllValidSplits(cards13) {
  const comb = combinations(cards13, 3); // 头道所有组合
  let splits = [];
  for (const head of comb) {
    const left1 = cards13.filter(c => !head.includes(c));
    for (const mid of combinations(left1, 5)) {
      const tail = left1.filter(c => !mid.includes(c));
      if (tail.length !== 5) continue;
      // 判断顺序合法(头<中<尾)
      const headRank = handTypeRank(head);
      const midRank = handTypeRank(mid);
      const tailRank = handTypeRank(tail);
      if (headRank > midRank || midRank > tailRank) continue;
      // 评分
      const score = scoreSplit(head, mid, tail);
      splits.push({ head, middle: mid, tail, score });
    }
    if (splits.length > 40) break; // 性能限制
  }
  return splits;
}

// 评分函数（可不断强化）
function scoreSplit(head, mid, tail) {
  // 尾道权重最大
  let score = handTypeScore(tail) * 100 + handTypeScore(mid) * 10 + handTypeScore(head);
  // 优化: 尾道炸弹+50，葫芦+25，同花顺+20，三条+10
  const tailType = handType(tail);
  if (tailType === "炸弹") score += 50;
  if (tailType === "葫芦") score += 25;
  if (tailType === "同花顺") score += 20;
  if (tailType === "三条") score += 10;
  if (handType(head) === "三条") score += 4;
  if (handType(head) === "对子") score += 2;
  return score;
}

// 牌型分数
function handTypeScore(cards) {
  switch (handType(cards)) {
    case "同花顺": return 12;
    case "炸弹": return 10;
    case "葫芦": return 8;
    case "同花": return 7;
    case "顺子": return 6;
    case "三条": return 4;
    case "两对": return 3;
    case "对子": return 2;
    case "高牌": return 1;
    default: return 0;
  }
}
// 牌型强度顺序
function handTypeRank(cards) {
  return handTypeScore(cards);
}

// 判断牌型
function handType(cards) {
  if (!cards || cards.length < 3) return "高牌";
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[2]);
  const uniqVals = Array.from(new Set(vals));
  const uniqSuits = Array.from(new Set(suits));
  if (cards.length === 5) {
    // 炸弹
    if (Object.values(groupBy(vals)).some(a => a.length === 4)) return "炸弹";
    // 同花顺
    if (uniqSuits.length === 1 && isStraight(vals)) return "同花顺";
    // 同花
    if (uniqSuits.length === 1) return "同花";
    // 顺子
    if (isStraight(vals)) return "顺子";
    // 葫芦
    if (Object.values(groupBy(vals)).some(a => a.length === 3) && Object.values(groupBy(vals)).some(a => a.length === 2)) return "葫芦";
    // 三条
    if (Object.values(groupBy(vals)).some(a => a.length === 3)) return "三条";
    // 两对
    if (Object.values(groupBy(vals)).filter(a => a.length === 2).length === 2) return "两对";
    // 一对
    if (Object.values(groupBy(vals)).some(a => a.length === 2)) return "对子";
    return "高牌";
  }
  // 头道3张
  if (cards.length === 3) {
    if (uniqVals.length === 1) return "三条";
    if (Object.values(groupBy(vals)).some(a => a.length === 2)) return "对子";
    return "高牌";
  }
  return "高牌";
}

// 是否顺子
function isStraight(vals) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  let idxs = vals.map(v => order.indexOf(v)).sort((a,b)=>a-b);
  // 普通顺子
  for (let i = 1; i < idxs.length; i++) if (idxs[i] !== idxs[i - 1] + 1) break;
  else if (i === idxs.length - 1) return true;
  // A23特殊顺子
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

// 生成所有n选k组合
function combinations(arr, k) {
  let res = [];
  function comb(path, start) {
    if (path.length === k) return res.push(path);
    for (let i = start; i < arr.length; ++i) comb([...path, arr[i]], i + 1);
  }
  comb([], 0);
  return res;
}

// 备用均衡分法
function balancedSplit(cards) {
  const sorted = [...cards];
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
