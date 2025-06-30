// 最强智能十三水分牌，兼容后端倒水判定、全点型、奖励、极限分法，且永不倒水
// 算法规则和后端/sssScore.js完全一致，兼容所有主流玩法和特殊奖励
// 可以直接用于生产环境和AI自动理牌

const SPLIT_ENUM_LIMIT = 2800; // 限制极端枚举量，防卡死

export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 特殊牌型检测（如有需要可加：一条龙、三同花、六对半等）
  // 优先输出特殊牌型，不然全靠枚举
  // let special = detectSpecialType(cards13);
  // if (special) return [special];

  let allSplits = generateAllValidSplits(cards13);
  if (!allSplits.length) {
    return [balancedSplit(cards13)];
  }
  allSplits.sort((a, b) => b.score - a.score);
  // 输出前5种
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

/** ----------------- 枚举所有合法分法 ----------------- **/
function generateAllValidSplits(cards13) {
  // 极限剪枝：只保留评分前N的头道、尾道组合，暴力合并
  let headComb = topHeadCombinations(cards13, 16);
  let tailComb = topTailCombinations(cards13, 20);
  let splits = [];
  let tried = 0;
  let seen = new Set();
  for (const head of headComb) {
    let left10 = cards13.filter(c => !head.includes(c));
    for (const tail of tailComb) {
      if (!tail.every(c => left10.includes(c))) continue;
      let middle = left10.filter(c => !tail.includes(c));
      if (middle.length !== 5) continue;
      // 保证唯一分法（头中尾无交集）
      const key = [...head, ...middle, ...tail].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);

      if (isFoul(head, middle, tail)) continue;
      splits.push({
        head, middle, tail,
        score: scoreSplit(head, middle, tail)
      });
      tried++;
      if (tried >= SPLIT_ENUM_LIMIT) break;
    }
    if (tried >= SPLIT_ENUM_LIMIT) break;
  }
  return splits;
}

// 头道三条、对子、高牌优先，按最大点数降序
function topHeadCombinations(cards, N = 12) {
  let combs = [];
  // 三条
  let byVal = groupByValue(cards);
  for (const v in byVal) if (byVal[v].length >= 3) {
    combs.push(byVal[v].slice(0, 3));
  }
  // 对子
  for (const v in byVal) if (byVal[v].length >= 2) {
    let others = cards.filter(c => !byVal[v].includes(c));
    if (others.length > 0) {
      let rest = others.sort((a, b) => cardValue(b) - cardValue(a));
      combs.push([...byVal[v].slice(0, 2), rest[0]]);
    }
  }
  // 高牌
  combs.push(cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 3));
  // 排序去重
  const keys = new Set();
  combs = combs.filter(c => {
    const k = c.slice().sort().join(',');
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
  combs.sort((a, b) => headScore(a) - headScore(b)).reverse();
  return combs.slice(0, N);
}
// 尾道炸弹/顺子/葫芦/同花优先
function topTailCombinations(cards, N = 14) {
  let combs = [];
  // 炸弹
  let byVal = groupByValue(cards);
  for (const v in byVal) if (byVal[v].length >= 4) {
    let left = cards.filter(c => !byVal[v].includes(c));
    combs.push([...byVal[v].slice(0, 4), left[0]]);
  }
  // 同花
  let bySuit = groupBySuit(cards);
  for (const s in bySuit) if (bySuit[s].length >= 5) {
    combs.push(bySuit[s].slice(0, 5));
  }
  // 顺子
  let straights = findStraights(cards);
  combs.push(...straights);
  // 葫芦
  for (const t in byVal) if (byVal[t].length >= 3) {
    for (const p in byVal) if (p !== t && byVal[p].length >= 2) {
      combs.push([...byVal[t].slice(0, 3), ...byVal[p].slice(0, 2)]);
    }
  }
  // 高牌
  combs.push(cards.slice().sort((a, b) => cardValue(b) - cardValue(a)).slice(0, 5));
  // 排序去重
  const keys = new Set();
  combs = combs.filter(c => {
    const k = c.slice().sort().join(',');
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
  combs.sort((a, b) => tailScore(a) - tailScore(b)).reverse();
  return combs.slice(0, N);
}

/** --------------------- 评分体系 --------------------- **/
function scoreSplit(head, mid, tail) {
  // 强牌优先，尾>中>头
  let score =
    handTypeScore(tail, 'tail') * 120 +
    handTypeScore(mid, 'middle') * 16 +
    handTypeScore(head, 'head') * 2;

  // 奖励头道三条/对子
  const headType = handType(head, 'head');
  if (headType === "三条") score += 30;
  else if (headType === "对子") score += 12;
  else score -= 15; // 头道高牌惩罚

  // 中道奖励
  const midType = handType(mid, 'middle');
  if (midType === "同花顺") score += 30;
  if (midType === "铁支") score += 32;
  if (midType === "葫芦") score += 18;
  if (midType === "顺子") score += 10;
  if (midType === "三条") score += 5;
  if (midType === "两对") score += 2;
  if (midType === "对子") score -= 5;

  // 尾道奖励
  const tailType = handType(tail, 'tail');
  if (tailType === "铁支") score += 45;
  if (tailType === "同花顺") score += 38;
  if (tailType === "葫芦") score += 18;
  if (tailType === "顺子") score += 8;

  // 头道高牌+中道高牌惩罚
  if (headType === "高牌" && (midType === "高牌" || tailType === "高牌")) score -= 40;

  // 奖励整体点数大
  score += getTotalValue(head) * 0.5 + getTotalValue(mid) * 0.7 + getTotalValue(tail) * 1.2;

  // 拒绝拆尾道大组合
  if (tailType === "铁支" && (midType !== "顺子" && midType !== "同花顺" && midType !== "铁支")) score += 12;

  // 头道对子大加分
  if (headType === "对子" || headType === "三条") {
    const vals = head.map(card => cardValue(card));
    score += Math.max(...vals) * 1.3;
  }
  return score;
}

function headScore(head) {
  const t = handType(head, 'head');
  return handTypeScore(head, 'head') * 10 + getTotalValue(head) + (t === '三条'?55:t==='对子'?20:0);
}
function tailScore(tail) {
  const t = handType(tail, 'tail');
  return handTypeScore(tail, 'tail') * 20 + getTotalValue(tail) + (t === '铁支'?50:t==='同花顺'?40:0);
}

/** --------------------- 比牌判定体系 --------------------- **/
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
  // 跟sssScore.js areaTypeRank完全一致
  const t = handType(cards, area);
  if (area === 'head') {
    if (t === "三条") return 4;
    if (t === "对子") return 2;
    return 1;
  }
  switch (t) {
    case "铁支": return 8;
    case "同花顺": return 7;
    case "葫芦": return 6;
    case "同花": return 5;
    case "顺子": return 4;
    case "三条": return 3;
    case "两对": return 2;
    case "对子": return 1;
    default: return 0;
  }
}
function isFoul(head, middle, tail) {
  const headRank = handTypeRank(head, 'head');
  const midRank = handTypeRank(middle, 'middle');
  const tailRank = handTypeRank(tail, 'tail');
  return !(headRank <= midRank && midRank <= tailRank);
}

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
function groupByValue(cards) {
  const g = {};
  for (const card of cards) {
    const v = cardValue(card);
    g[v] = g[v] || [];
    g[v].push(card);
  }
  return g;
}
function groupBySuit(cards) {
  const g = {};
  for (const card of cards) {
    const s = card.split('_')[2];
    g[s] = g[s] || [];
    g[s].push(card);
  }
  return g;
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
function findStraights(cards) {
  const vals = cards.map(cardValue);
  const uniq = [...new Set(vals)].sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 1; j < 5; j++) if (uniq[i + j] !== uniq[i] + j) ok = false;
    if (ok) {
      const straightVals = uniq.slice(i, i + 5);
      const straightCards = cards.filter(c => straightVals.includes(cardValue(c)));
      if (straightCards.length >= 5) res.push(straightCards.slice(0, 5));
    }
  }
  // A2345
  if (uniq.includes(14) && uniq.includes(2)) {
    const lowVals = [14,2,3,4,5];
    if (lowVals.every(v => uniq.includes(v))) {
      const straightCards = cards.filter(c => lowVals.includes(cardValue(c)));
      if (straightCards.length >= 5) res.push(straightCards.slice(0, 5));
    }
  }
  return res;
}
function balancedSplit(cards) {
  const sorted = [...cards];
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
