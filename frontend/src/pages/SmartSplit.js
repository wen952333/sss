// 智能分牌与AI补位模块

// 主入口：输入13张牌（["2_of_hearts", ...]），返回5组优选分法 [{head, middle, tail}, ...]
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  let splits = [];
  splits.push(bestShunziSplit(cards13));
  splits.push(bestTripsSplit(cards13));
  splits.push(bestFlushSplit(cards13));
  splits.push(bestBombSplit(cards13));
  splits.push(balancedSplit(cards13));
  splits = splits.filter(isValidSplit);
  // 不足5种分法补齐均衡（永远输出5组）
  while (splits.length < 5) splits.push(balancedSplit(cards13));
  return splits.slice(0, 5);
}

// AI为自己（或补位AI）进行智能优选分牌，返回最优分法
export function aiSmartSplit(cards13) {
  const splits = getSmartSplits(cards13);
  // 取第一组为AI分法
  return splits[0] || { head: cards13.slice(0,3), middle: cards13.slice(3,8), tail: cards13.slice(8,13) };
}

// 给定 [{name, isAI, cards13}], 为所有AI补位自动分三道
export function fillAiPlayers(playersArr) {
  return playersArr.map(p =>
    p.isAI && Array.isArray(p.cards13) && p.cards13.length === 13
      ? { ...p, ...aiSmartSplit(p.cards13) }
      : p
  );
}

// 玩家点击“智能分牌”时循环5种优选分法
export function getPlayerSmartSplits(cards13) {
  return getSmartSplits(cards13);
}

// 判断分法是否合法（禁止倒水：头<中<尾）
function isValidSplit(split) {
  if (!split) return false;
  const rank = handRank;
  return rank(split.head) < rank(split.middle) && rank(split.middle) < rank(split.tail);
}

// 牌型强度简单分级（1高牌 2对子 3两对 4三条 5顺子 6同花 7葫芦 8炸弹 9同花顺）
function handRank(cards) {
  if (!cards || cards.length < 3) return 0;
  const vals = cards.map(card => card.split('_')[0]);
  const suits = cards.map(card => card.split('_')[2]);
  const uniqVals = Array.from(new Set(vals));
  const uniqSuits = Array.from(new Set(suits));
  if (uniqVals.length === 1) return 8; // 炸弹/三条
  if (uniqSuits.length === 1) return 6; // 同花
  if (isStraight(vals)) return 5; // 顺子
  if (uniqVals.length === 2) return 4; // 三条/两对
  if (uniqVals.length === 3) return 3; // 两对
  if (uniqVals.length === cards.length - 1) return 2; // 一对
  return 1;
}
function isStraight(vals) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  const idxs = vals.map(v => order.indexOf(v)).sort((a,b)=>a-b);
  for(let i=1;i<idxs.length;i++) if (idxs[i]!==idxs[0]+i) return false;
  return true;
}

// 1. 顺子优先分法
function bestShunziSplit(cards) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  const sorted = [...cards].sort((a,b)=>order.indexOf(a.split('_')[0])-order.indexOf(b.split('_')[0]));
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
// 2. 三条优先分法
function bestTripsSplit(cards) {
  const groups = groupByValue(cards);
  const sorted = Object.values(groups).sort((a,b)=>b.length-a.length).flat();
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
// 3. 同花优先分法
function bestFlushSplit(cards) {
  const suits = {};
  cards.forEach(c=>{
    const s = c.split('_')[2];
    suits[s] = suits[s]||[];
    suits[s].push(c);
  });
  const flush = Object.values(suits).sort((a,b)=>b.length-a.length).flat();
  return {head: flush.slice(0,3), middle: flush.slice(3,8), tail: flush.slice(8,13)};
}
// 4. 炸弹优先分法
function bestBombSplit(cards) {
  const groups = groupByValue(cards);
  let bomb = [];
  for(const arr of Object.values(groups)) if(arr.length===4) bomb=arr;
  let rest = cards.filter(c=>!bomb.includes(c));
  return {head: rest.slice(0,3), middle: rest.slice(3,8), tail: bomb.concat(rest.slice(8))};
}
// 5. 均衡分法
function balancedSplit(cards) {
  const sorted = [...cards];
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}

function groupByValue(cards) {
  const groups = {};
  cards.forEach(c=>{
    const v = c.split('_')[0];
    groups[v] = groups[v]||[];
    groups[v].push(c);
  });
  return groups;
}
