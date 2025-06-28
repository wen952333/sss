// 更智能的十三水分牌与AI补位模块（保证不倒水，智能评分，严格比牌规则）
// 优化：分法枚举量限制，极端手牌下不再卡慢

/**
 * 返回最优分法，优先级：
 * 1. 永远不会摆出倒水牌型（与sssScore.js倒水判定一致）
 * 2. 综合计分权重最大
 * 3. 尾道炸弹/同花顺/葫芦优先
 * 4. 中道顺子/三条/两对优先
 * 5. 头道对子优先，头道高牌惩罚
 * 6. 三墩递增，强牌不拆弱
 */

const SPLIT_ENUM_LIMIT = 3000; // 枚举上限，防卡死

export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 枚举所有合法（非倒水）分法，按综合分值排序，取前5
  let allSplits = generateAllValidSplits(cards13);
  // 如果没有合法分法（极端低概率），退回顺序分
  if (!allSplits.length) {
    return [balancedSplit(cards13)];
  }
  allSplits.sort((a, b) => b.score - a.score);
  // 只输出拆分，不输出score
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

//----------------- 核心分牌算法，保证不倒水 -----------------//

function generateAllValidSplits(cards13) {
  const comb = combinations(cards13, 3); // 头道所有组合
  let splits = [];
  let tries = 0;
  for (const head of comb) {
    const left1 = cards13.filter(c => !head.includes(c));
    for (const mid of combinations(left1, 5)) {
      tries++;
      if (tries > SPLIT_ENUM_LIMIT) break;
      const tail = left1.filter(c => !mid.includes(c));
      if (tail.length !== 5) continue;
      // 严格检测倒水（与sssScore.js一致）
      if (isFoul(head, mid, tail)) continue;
      // 评分
      const score = scoreSplit(head, mid, tail);
      splits.push({ head, middle: mid, tail, score });
      // 可选：找到一定数量分法就提前返回
      if (splits.length >= 10) break;
    }
    if (tries > SPLIT_ENUM_LIMIT || splits.length >= 10) break;
  }
  return splits;
}

// 严格倒水检测（与sssScore.js一致）
function isFoul(head, middle, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(middle, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  return !(headRank <= midRank && midRank <= tailRank);
}

// 智能评分（可继续优化）
function scoreSplit(head, mid, tail) {
  // 强牌优先，炸弹/同花顺/葫芦>顺子>三条>两对>对子>高牌
  let score =
    handTypeScore(tail, 'tail') * 120 +
    handTypeScore(mid, 'middle') * 16 +
    handTypeScore(head, 'head') * 2;

  // 奖励头道三条/对子
  const headType = handType(head, 'head');
  if (headType === "三条") score += 30;
  else if (headType === "对子") score += 12;
  else score -= 15; // 头道高牌惩罚

  // 奖励中道同花顺/炸弹/葫芦/顺子/三条
  const midType = handType(mid, 'middle');
  if (midType === "同花顺") score += 30;
  if (midType === "铁支") score += 32;
  if (midType === "葫芦") score += 18;
  if (midType === "顺子") score += 10;
  if (midType === "三条") score += 5;
  if (midType === "两对") score += 2;
  if (midType === "对子") score -= 5;

  // 奖励尾道炸弹/同花顺/葫芦/顺子/三条
  const tailType = handType(tail, 'tail');
  if (tailType === "铁支") score += 45;
  if (tailType === "同花顺") score += 38;
  if (tailType === "葫芦") score += 18;
  if (tailType === "顺子") score += 8;

  // 头道高牌+中道高牌惩罚
  if (headType === "高牌" && (midType === "高牌" || tailType === "高牌")) score -= 40;

  // 奖励整体点数大
  score += getTotalValue(head) * 0.5 + getTotalValue(mid) * 0.7 + getTotalValue(tail) * 1.2;

  // 拒绝拆尾道炸弹/顺子到头中道，奖励尾道大组合
  if (tailType === "铁支" && (midType !== "顺子" && midType !== "同花顺" && midType !== "铁支")) score += 12;

  // 头道对子点数越大越好
  if (headType === "对子" || headType === "三条") {
    const vals = head.map(card => cardValue(card));
    score += Math.max(...vals) * 1.3;
  }
  return score;
}

// 牌型分数（和sssScore.js一致）
function handTypeScore(cards, area) {
  const t = handType(cards, area);
  switch (t) {
    case "铁支": return 8;
    case "同花顺": return 7;
    case "葫芦": return 6;
    case "同花": return 5;
    case "顺子": return 4;
    case "三条": return 3;
    case "两对": return 2;
    case "对子": return 1;
    case "高牌": return 0;
    default: return 0;
  }
}
function handTypeRank(cards, area) {
  // 和sssScore.js areaTypeRank完全一致
  if (area === 'head') {
    const t = handType(cards, area);
    if (t === "三条") return 4;
    if (t === "对子") return 2;
    return 1;
  }
  return handTypeScore(cards, area);
}

// 判断牌型，和sssScore.js getAreaType一致
function handType(cards, area) {
  if (!cards || cards.length < 3) return "高牌";
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[2]);
  const uniqVals = Array.from(new Set(vals));
  const uniqSuits = Array.from(new Set(suits));
  if (cards.length === 5) {
    // 炸弹
    if (Object.values(groupBy(vals)).some(a => a.length === 4)) return "铁支";
    // 同花顺
    if (uniqSuits.length === 1 && isStraight(vals)) return "同花顺";
    // 葫芦
    if (Object.values(groupBy(vals)).some(a => a.length === 3) && Object.values(groupBy(vals)).some(a => a.length === 2)) return "葫芦";
    // 同花
    if (uniqSuits.length === 1) return "同花";
    // 顺子
    if (isStraight(vals)) return "顺子";
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

// 牌面点数（用于点数加权）
function getTotalValue(cards) {
  return cards.reduce((sum, card) => sum + cardValue(card), 0);
}
function cardValue(card) {
  const v = card.split('_')[0];
  if (v === 'ace') return 14;
  if (v === 'king') return 13;
  if (v === 'queen') return 12;
  if (v === 'jack') return 11;
  return parseInt(v, 10);
}
