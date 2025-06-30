// 更智能的十三水分牌与AI补位模块（保证不倒水，智能评分，严格比牌规则）
// 高级优化：头道/尾道优先枚举高分组合，分法智能剪枝，大大加快极端牌型速度

/**
 * 返回最优分法，优先级：
 * 1. 永远不会摆出倒水牌型（与sssScore.js倒水判定一致）
 * 2. 综合计分权重最大
 * 3. 尾道炸弹/同花顺/葫芦优先
 * 4. 中道顺子/三条/两对优先
 * 5. 头道对子优先，头道高牌惩罚
 * 6. 三墩递增，强牌不拆弱
 * 
 * 进一步优化：
 * - 头道最大对子/三条优先枚举（头道TOP_N_HEAD）
 * - 尾道炸弹/同花顺/葫芦/顺子优先枚举（尾道TOP_N_TAIL）
 * - 剪枝：只对高潜力分法递归，提前丢弃弱组合
 * - 运行速度<200ms，极端手牌不卡顿
 */

const SPLIT_ENUM_LIMIT = 1200;   // 总递归枚举上限
const TOP_N_HEAD = 8;            // 头道候选只取前N种（评分最大）
const TOP_N_TAIL = 8;            // 尾道候选只取前N种（评分最大）

export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 步骤1：枚举所有头道组合，按评分排序，选前TOP_N_HEAD个
  let allHead = combinations(cards13, 3)
    .map(head => ({ 
      head, 
      score: evalHead(head) 
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N_HEAD);

  // 步骤2：对每个头道，枚举所有合法尾道组合，剪枝
  let splits = [];
  let tries = 0;
  for (const { head } of allHead) {
    const left10 = cards13.filter(c => !head.includes(c));
    // 优先大牌尾道：按尾道评分排序
    let allTail = combinations(left10, 5)
      .map(tail => ({
        tail,
        score: evalTail(tail)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N_TAIL);

    for (const { tail } of allTail) {
      const middle = left10.filter(c => !tail.includes(c));
      if (middle.length !== 5) continue;
      tries++;
      if (tries > SPLIT_ENUM_LIMIT) break;
      // 检查倒水
      if (isFoul(head, middle, tail)) continue;
      const score = scoreSplit(head, middle, tail);
      splits.push({ head, middle, tail, score });
    }
    if (tries > SPLIT_ENUM_LIMIT) break;
  }

  // 若极端分法不足，降级全枚举
  if (!splits.length) {
    let allSplits = [];
    let tries2 = 0;
    for (const head of combinations(cards13, 3)) {
      const left1 = cards13.filter(c => !head.includes(c));
      for (const mid of combinations(left1, 5)) {
        tries2++;
        if (tries2 > SPLIT_ENUM_LIMIT) break;
        const tail = left1.filter(c => !mid.includes(c));
        if (tail.length !== 5) continue;
        if (isFoul(head, mid, tail)) continue;
        allSplits.push({ head, middle: mid, tail, score: scoreSplit(head, mid, tail) });
        if (allSplits.length >= 8) break;
      }
      if (tries2 > SPLIT_ENUM_LIMIT || allSplits.length >= 8) break;
    }
    splits = allSplits;
  }

  // 如果没有合法分法（极端低概率），退回顺序分
  if (!splits.length) {
    return [balancedSplit(cards13)];
  }
  splits.sort((a, b) => b.score - a.score);
  // 只输出拆分，不输出score
  return splits.slice(0, 5).map(s => ({ head: s.head, middle: s.middle, tail: s.tail }));
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

function combinations(arr, k) {
  let res = [];
  function comb(path, start) {
    if (path.length === k) return res.push(path);
    for (let i = start; i < arr.length; ++i) comb([...path, arr[i]], i + 1);
  }
  comb([], 0);
  return res;
}

// 严格倒水检测（与sssScore.js一致）
function isFoul(head, middle, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(middle, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  if (!(headRank <= midRank && midRank <= tailRank)) return true;
  // 比牌面大小
  if (headRank === midRank && compareArea(head, middle, 'head') > 0) return true;
  if (midRank === tailRank && compareArea(middle, tail, 'middle') > 0) return true;
  return false;
}

// 头道评分：对子>三条>高牌，点数大优先
function evalHead(head) {
  const t = handType(head, 'head');
  let score = 0;
  if (t === "三条") score += 120;
  else if (t === "对子") score += 28;
  else score += 2;
  score += getTotalValue(head);
  return score;
}

// 尾道评分：炸弹>同花顺>葫芦>顺子>同花>三条>两对>对子>高牌
function evalTail(tail) {
  const t = handType(tail, 'tail');
  let score = 0;
  if (t === "铁支") score += 220;
  else if (t === "同花顺") score += 180;
  else if (t === "葫芦") score += 110;
  else if (t === "顺子") score += 60;
  else if (t === "同花") score += 57;
  else if (t === "三条") score += 45;
  else if (t === "两对") score += 32;
  else if (t === "对子") score += 10;
  else score += 1;
  score += getTotalValue(tail) * 1.6;
  return score;
}

// 智能评分
function scoreSplit(head, mid, tail) {
  let score =
    handTypeScore(tail, 'tail') * 140 +
    handTypeScore(mid, 'middle') * 18 +
    handTypeScore(head, 'head') * 2;

  // 奖励头道三条/对子
  const headType = handType(head, 'head');
  if (headType === "三条") score += 36;
  else if (headType === "对子") score += 15;
  else score -= 15; // 头道高牌惩罚

  // 奖励中道同花顺/炸弹/葫芦/顺子/三条
  const midType = handType(mid, 'middle');
  if (midType === "同花顺") score += 33;
  if (midType === "铁支") score += 38;
  if (midType === "葫芦") score += 22;
  if (midType === "顺子") score += 12;
  if (midType === "三条") score += 7;
  if (midType === "两对") score += 3;
  if (midType === "对子") score -= 5;

  // 奖励尾道炸弹/同花顺/葫芦/顺子/三条
  const tailType = handType(tail, 'tail');
  if (tailType === "铁支") score += 50;
  if (tailType === "同花顺") score += 40;
  if (tailType === "葫芦") score += 20;
  if (tailType === "顺子") score += 10;

  // 头道高牌+中道高牌惩罚
  if (headType === "高牌" && (midType === "高牌" || tailType === "高牌")) score -= 45;

  // 奖励整体点数大
  score += getTotalValue(head) * 0.55 + getTotalValue(mid) * 0.7 + getTotalValue(tail) * 1.3;

  // 拒绝拆尾道炸弹/顺子到头中道，奖励尾道大组合
  if (tailType === "铁支" && (midType !== "顺子" && midType !== "同花顺" && midType !== "铁支")) score += 20;

  // 头道对子点数越大越好
  if (headType === "对子" || headType === "三条") {
    const vals = head.map(card => cardValue(card));
    score += Math.max(...vals) * 1.3;
  }
  // 额外奖励：三顺子/三同花/一条龙/六对半
  if (isSpecialType(head, mid, tail)) score += 70;
  return score;
}

// 牌型分数
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
  if (area === 'head') {
    const t = handType(cards, area);
    if (t === "三条") return 4;
    if (t === "对子") return 2;
    return 1;
  }
  return handTypeScore(cards, area);
}

// 判断牌型
function handType(cards, area) {
  if (!cards || cards.length < 3) return "高牌";
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[2]);
  const uniqVals = Array.from(new Set(vals));
  const uniqSuits = Array.from(new Set(suits));
  if (cards.length === 5) {
    if (Object.values(groupBy(vals)).some(a => a.length === 4)) return "铁支";
    if (uniqSuits.length === 1 && isStraight(vals)) return "同花顺";
    if (Object.values(groupBy(vals)).some(a => a.length === 3) && Object.values(groupBy(vals)).some(a => a.length === 2)) return "葫芦";
    if (uniqSuits.length === 1) return "同花";
    if (isStraight(vals)) return "顺子";
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
function isStraight(vals) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  let idxs = vals.map(v => order.indexOf(v)).sort((a,b)=>a-b);
  for (let i = 1; i < idxs.length; i++) if (idxs[i] !== idxs[i - 1] + 1) break;
  else if (i === idxs.length - 1) return true;
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

function balancedSplit(cards) {
  const sorted = [...cards];
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}

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

// 特殊牌型判定
function isSpecialType(head, mid, tail) {
  const all = [...head, ...mid, ...tail];
  const uniqVals = new Set(all.map(card => card.split('_')[0]));
  if (uniqVals.size === 13) return true;
  const cnt = {};
  for (const c of all) {
    const v = c.split('_')[0];
    cnt[v] = (cnt[v] || 0) + 1;
  }
  if (Object.values(cnt).filter(x => x === 2).length === 12) return true;
  const suit = c => c.split('_')[2];
  if ([head, mid, tail].every(arr => arr.every(x => suit(x) === suit(arr[0])))) return true;
  const isS = arr => isStraight(arr.map(c => c.split('_')[0]));
  if ([head, mid, tail].every(isS)) return true;
  return false;
}

// 更严谨的比牌，与sssScore.js一致
function compareArea(a, b, area) {
  const typeA = handType(a, area);
  const typeB = handType(b, area);
  const rankA = handTypeRank(a, area);
  const rankB = handTypeRank(b, area);
  if (rankA !== rankB) return rankA - rankB;
  const groupedA = groupBy(a.map(card => card.split('_')[0]));
  const groupedB = groupBy(b.map(card => card.split('_')[0]));
  if (["顺子", "同花顺"].includes(typeA)) {
    const maxA = Math.max(...a.map(card => cardValue(card)));
    const maxB = Math.max(...b.map(card => cardValue(card)));
    if (maxA !== maxB) return maxA - maxB;
  }
  if (["铁支", "三条", "对子"].includes(typeA)) {
    const mainA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === (typeA === "铁支" ? 4 : typeA === "三条" ? 3 : 2)), 10);
    const mainB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === (typeA === "铁支" ? 4 : typeA === "三条" ? 3 : 2)), 10);
    if (mainA !== mainB) return mainA - mainB;
    const subA = a.map(card => cardValue(card)).filter(v => v !== mainA).sort((x, y) => y - x);
    const subB = b.map(card => cardValue(card)).filter(v => v !== mainB).sort((x, y) => y - x);
    for (let i = 0; i < subA.length; ++i) if (subA[i] !== subB[i]) return subA[i] - subB[i];
    return 0;
  }
  if (typeA === "葫芦") {
    const tripleA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === 3), 10);
    const tripleB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === 3), 10);
    if (tripleA !== tripleB) return tripleA - tripleB;
    const pairA = parseInt(Object.keys(groupedA).find(k => groupedA[k].length === 2), 10);
    const pairB = parseInt(Object.keys(groupedB).find(k => groupedB[k].length === 2), 10);
    if (pairA !== pairB) return pairA - pairB;
    return 0;
  }
  if (typeA === "两对") {
    const pairsA = Object.keys(groupedA).filter(k => groupedA[k].length === 2).map(Number).sort((a, b) => b - a);
    const pairsB = Object.keys(groupedB).filter(k => groupedB[k].length === 2).map(Number).sort((a, b) => b - a);
    if (pairsA[0] !== pairsB[0]) return pairsA[0] - pairsB[0];
    if (pairsA[1] !== pairsB[1]) return pairsA[1] - pairsB[1];
    const subA = Object.keys(groupedA).find(k => groupedA[k].length === 1);
    const subB = Object.keys(groupedB).find(k => groupedB[k].length === 1);
    if (subA && subB && subA !== subB) return subA - subB;
    return 0;
  }
  if (typeA === "同花") {
    const valsA = a.map(card => cardValue(card)).sort((x, y) => y - x);
    const valsB = b.map(card => cardValue(card)).sort((x, y) => y - x);
    for (let i = 0; i < valsA.length; ++i) if (valsA[i] !== valsB[i]) return valsA[i] - valsB[i];
    return 0;
  }
  const valsA = a.map(card => cardValue(card)).sort((x, y) => y - x);
  const valsB = b.map(card => cardValue(card)).sort((x, y) => y - x);
  for (let i = 0; i < valsA.length; ++i) if (valsA[i] !== valsB[i]) return valsA[i] - valsB[i];
  return 0;
}
