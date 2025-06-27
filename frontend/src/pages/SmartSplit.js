// 只导出智能分牌函数，不包含React
export function getSmartSplits(cards13) {
  if (!Array.isArray(cards13) || cards13.length !== 13) return [];
  let splits = [];
  splits.push(bestShunziSplit(cards13));
  splits.push(bestTripsSplit(cards13));
  splits.push(bestFlushSplit(cards13));
  splits.push(bestBombSplit(cards13));
  splits.push(balancedSplit(cards13));
  splits = splits.filter(isValidSplit);
  while (splits.length < 5) splits.push(balancedSplit(cards13));
  return splits.slice(0,5);
}

function isValidSplit(split) {
  if (!split) return false;
  const rank = handRank;
  return rank(split.head) < rank(split.middle) && rank(split.middle) < rank(split.tail);
}

function handRank(cards) {
  if (!cards || cards.length < 3) return 0;
  const vals = cards.map(card => card.split('_')[0]);
  const uniqVals = Array.from(new Set(vals));
  if (uniqVals.length === 1) return 8;
  if (isStraight(vals)) return 5;
  if (uniqVals.length === 2) return 4;
  if (uniqVals.length === 3) return 3;
  if (uniqVals.length === cards.length - 1) return 2;
  return 1;
}
function isStraight(vals) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  const idxs = vals.map(v => order.indexOf(v)).sort((a,b)=>a-b);
  for(let i=1;i<idxs.length;i++) if (idxs[i]!==idxs[0]+i) return false;
  return true;
}
function bestShunziSplit(cards) {
  const order = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  const sorted = [...cards].sort((a,b)=>order.indexOf(a.split('_')[0])-order.indexOf(b.split('_')[0]));
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
function bestTripsSplit(cards) {
  const groups = groupByValue(cards);
  const sorted = Object.values(groups).sort((a,b)=>b.length-a.length).flat();
  return {head: sorted.slice(0,3), middle: sorted.slice(3,8), tail: sorted.slice(8,13)};
}
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
function bestBombSplit(cards) {
  const groups = groupByValue(cards);
  let bomb = [];
  for(const arr of Object.values(groups)) if(arr.length===4) bomb=arr;
  let rest = cards.filter(c=>!bomb.includes(c));
  return {head: rest.slice(0,3), middle: rest.slice(3,8), tail: bomb.concat(rest.slice(8))};
}
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
