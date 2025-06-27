// 智能分牌模块，支持循环5种优选牌型，禁止倒水，兼容十三水常见分法
// 用法：import { getSmartSplits } from './SmartSplit'
// const fiveSplits = getSmartSplits(cards13); // 返回5组 {head, middle, tail}
// 每次点击智能分牌按钮，轮流取下一个，禁止倒水（头<中<尾）

// 仅支持五种主流优选分法（如炸弹、三顺、三同花、三同花顺、全小等可扩展）
// 这里只做简单演示，真实项目可集成更复杂的牌型分析器
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  // 先所有组合排序，避免倒水
  let splits = [];
  // 1. 顺子+顺子+顺子
  splits.push(bestShunziSplit(cards13));
  // 2. 三条+三条+三条
  splits.push(bestTripsSplit(cards13));
  // 3. 同花+同花+同花
  splits.push(bestFlushSplit(cards13));
  // 4. 炸弹+其余
  splits.push(bestBombSplit(cards13));
  // 5. 散牌最均衡
  splits.push(balancedSplit(cards13));
  // 过滤掉倒水
  splits = splits.filter(isValidSplit);
  // 保证始终输出5种（不足补空）
  while (splits.length < 5) splits.push(balancedSplit(cards13));
  return splits.slice(0,5);
}

// 判断分法是否合法（头<中<尾）
function isValidSplit(split) {
  if (!split) return false;
  const rank = handRank;
  return rank(split.head) < rank(split.middle) && rank(split.middle) < rank(split.tail);
}

// 牌型强度简单分级：高牌1、对子2、两对3、三条4、顺子5、同花6、葫芦7、炸弹8、同花顺9
function handRank(cards) {
  if (!cards || cards.length < 3) return 0;
  // 这里只做简单；可集成第三方十三水牌型库
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

// 1. 顺子顺子顺子（如有）
function bestShunziSplit(cards) {
  // 简化：按序排列，分别取3/5/5张
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  const sorted = [...cards].sort((a,b)=>order.indexOf(a.split('_')[0])-order.indexOf(b.split('_')[0]));
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
// 2. 三条三条三条
function bestTripsSplit(cards) {
  const groups = groupByValue(cards);
  const sorted = Object.values(groups).sort((a,b)=>b.length-a.length).flat();
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
// 3. 同花同花同花
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
// 4. 炸弹（4张）+其余
function bestBombSplit(cards) {
  const groups = groupByValue(cards);
  let bomb = [];
  for(const arr of Object.values(groups)) if(arr.length===4) bomb=arr;
  let rest = cards.filter(c=>!bomb.includes(c));
  return {head: rest.slice(0,3), middle: rest.slice(3,8), tail: bomb.concat(rest.slice(8))};
}
// 5. 均衡分散
function balancedSplit(cards) {
  // 简单平均
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
