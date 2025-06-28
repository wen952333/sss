// 十三水比牌计分核心（支持特殊牌型、花色、顺子等全规则）
// 用于试玩、AI模拟，纯前端

const SUIT_ORDER = { spades: 4, hearts: 3, clubs: 2, diamonds: 1 };
const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, jack: 11, queen: 12, king: 13, ace: 14
};

export function calcSSSAllScores(players) {
  // players: [{head,middle,tail,name}, ...]
  // 返回每人总分数组
  const N = players.length;
  const marks = new Array(N).fill(0);

  // 特殊牌型预判
  const specials = players.map(p => ({ type: checkSpecial(p), player: p }));
  const specialRanks = specials.map(s => s.type ? specialTypeRank(s.type) : 0);

  for (let i = 0; i < N; ++i) {
    for (let j = 0; j < N; ++j) {
      if (i === j) continue;
      // 特殊牌型只和普通牌型比
      if (specials[i].type && !specials[j].type) {
        marks[i] += 3;
        continue;
      }
      if (!specials[i].type && specials[j].type) {
        continue;
      }
      if (specials[i].type && specials[j].type) {
        // 相同特殊打平，不加分
        if (specialRanks[i] === specialRanks[j]) continue;
        // 大特殊赢小特殊
        if (specialRanks[i] > specialRanks[j]) marks[i] += 3;
        continue;
      }

      // 普通牌型：必须三道全胜才能得分
      const [headRes, middleRes, tailRes] = [
        compareArea(players[i].head, players[j].head, 'head'),
        compareArea(players[i].middle, players[j].middle, 'middle'),
        compareArea(players[i].tail, players[j].tail, 'tail')
      ];
      if (headRes > 0 && middleRes > 0 && tailRes > 0) {
        // 得分=三道分相加
        marks[i] += getAreaScore(players[i].head, 'head')
                 + getAreaScore(players[i].middle, 'middle')
                 + getAreaScore(players[i].tail, 'tail');
      }
    }
  }
  return marks;
}

// --------- 牌型及特殊牌型判定 ---------
function checkSpecial(p) {
  // 一条龙
  const all = [...p.head, ...p.middle, ...p.tail];
  const uniqVals = new Set(all.map(c => c.split('_')[0]));
  if (uniqVals.size === 13) return '一条龙';

  // 六对半
  const count = {};
  all.forEach(c => {
    const v = c.split('_')[0];
    count[v] = (count[v] || 0) + 1;
  });
  let pairs = 0, single = 0;
  Object.values(count).forEach(v => {
    if (v === 2) pairs++;
    if (v === 1) single++;
    if (v === 4) pairs += 2;
  });
  if (pairs === 6 && single === 1) return '六对半';

  // 三同花
  if (isSameSuit(p.head) && isSameSuit(p.middle) && isSameSuit(p.tail) && !isStraightFlush(p.tail))
    return '三同花';

  // 三顺子
  if (isStraight(p.head) && isStraight(p.middle) && isStraight(p.tail) && !isStraightFlush(p.tail))
    return '三顺子';

  return null;
}
function specialTypeRank(type) {
  switch(type) {
    case '一条龙': return 4;
    case '三同花': return 3;
    case '三顺子': return 2;
    case '六对半': return 1;
    default: return 0;
  }
}

// --------- 单墩比较 ---------
function compareArea(a, b, area) {
  // 永远分胜负
  const typeA = getAreaType(a, area);
  const typeB = getAreaType(b, area);
  const typeRankA = areaTypeRank(typeA, area);
  const typeRankB = areaTypeRank(typeB, area);
  if (typeRankA !== typeRankB) return typeRankA > typeRankB ? 1 : -1;

  // 牌型相同，点数比
  const mainA = mainPoint(a, typeA, area);
  const mainB = mainPoint(b, typeB, area);
  if (mainA !== mainB) return mainA > mainB ? 1 : -1;

  // 花色比
  const suitA = mainSuit(a, typeA, area);
  const suitB = mainSuit(b, typeB, area);
  if (suitA !== suitB) return suitA > suitB ? 1 : -1;

  // 副牌再比点
  const subA = subPoints(a, typeA, area);
  const subB = subPoints(b, typeB, area);
  for (let i = 0; i < subA.length; ++i) {
    if (subA[i] !== subB[i]) return subA[i] > subB[i] ? 1 : -1;
  }
  // 副牌再比花色
  const subsuitA = subSuits(a, typeA, area);
  const subsuitB = subSuits(b, typeB, area);
  for (let i = 0; i < subsuitA.length; ++i) {
    if (subsuitA[i] !== subsuitB[i]) return subsuitA[i] > subsuitB[i] ? 1 : -1;
  }
  // 不可能平
  return 0;
}

// --------- 三道牌型及分值 ---------
function getAreaScore(cards, area) {
  const type = getAreaType(cards, area);
  if (area === 'head') {
    if (type === "三条") return 3;
    return 1;
  }
  if (area === 'middle') {
    if (type === "铁支") return 8;
    if (type === "同花顺") return 10;
    if (type === "葫芦") return 2;
    return 1;
  }
  if (area === 'tail') {
    if (type === "铁支") return 4;
    if (type === "同花顺") return 5;
    return 1;
  }
  return 1;
}
function getAreaType(cards, area) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  const suits = cards.map(c => c.split('_')[2]);
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
  if (area === 'head') {
    if (Object.values(cnt).includes(3)) return "三条";
    if (Object.values(cnt).includes(2)) return "对子";
    return "高牌";
  }
  if (Object.values(cnt).includes(4)) return "铁支";
  if (isSameSuitArr(suits) && isStraightVals(vals)) return "同花顺";
  if (Object.values(cnt).includes(3) && Object.values(cnt).includes(2)) return "葫芦";
  if (isSameSuitArr(suits)) return "同花";
  if (isStraightVals(vals)) return "顺子";
  if (Object.values(cnt).includes(3)) return "三条";
  if (Object.values(cnt).filter(c => c === 2).length === 2) return "两对";
  if (Object.values(cnt).includes(2)) return "对子";
  return "高牌";
}
function areaTypeRank(type, area) {
  if (area === 'head') {
    if (type === "三条") return 4;
    if (type === "对子") return 2;
    return 1;
  }
  if (type === "铁支") return 8;
  if (type === "同花顺") return 7;
  if (type === "葫芦") return 6;
  if (type === "同花") return 5;
  if (type === "顺子") return 4;
  if (type === "三条") return 3;
  if (type === "两对") return 2;
  if (type === "对子") return 1;
  return 0;
}

// --------- 牌型点数、花色、顺子辅助 ---------
// 主点
function mainPoint(cards, type, area) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
  if (type === "三条" || type === "铁支" || type === "对子") {
    return Number(Object.entries(cnt).sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0]);
  }
  if (type === "葫芦") {
    return Number(Object.entries(cnt).find(e=>e[1]===3)[0]);
  }
  if (type === "同花顺" || type === "顺子") {
    // 按特殊顺子大小
    const svals = [...vals].sort((a,b)=>a-b);
    if (JSON.stringify(svals)==='[10,11,12,13,14]') return 999;
    if (JSON.stringify(svals)==='[2,3,4,5,14]') return 998;
    if (JSON.stringify(svals)==='[9,10,11,12,13]') return 997;
    if (JSON.stringify(svals)==='[8,9,10,11,12]') return 996;
    if (JSON.stringify(svals)==='[7,8,9,10,11]') return 995;
    return Math.max(...vals);
  }
  return Math.max(...vals);
}
// 主花色
function mainSuit(cards, type, area) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  const suits = cards.map(c => c.split('_')[2]);
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
  let main;
  if (type === "三条" || type === "铁支" || type === "对子") {
    main = Number(Object.entries(cnt).sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0]);
  }
  if (type === "葫芦") {
    main = Number(Object.entries(cnt).find(e=>e[1]===3)[0]);
  }
  if (type === "同花顺" || type === "顺子") {
    main = mainPoint(cards,type,area);
  }
  // 找对应花色最大
  let maxSuit = 0;
  cards.forEach(c => {
    const v = VALUE_ORDER[c.split('_')[0]];
    if (v === main) maxSuit = Math.max(maxSuit, SUIT_ORDER[c.split('_')[2]]);
  });
  return maxSuit;
}
// 副点数组
function subPoints(cards, type, area) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
  let main;
  if (type === "三条" || type === "铁支" || type === "对子") {
    main = Number(Object.entries(cnt).sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0]);
    return vals.filter(v=>v!==main).sort((a,b)=>b-a);
  }
  if (type === "葫芦") {
    main = Number(Object.entries(cnt).find(e=>e[1]===3)[0]);
    return vals.filter(v=>v!==main).sort((a,b)=>b-a);
  }
  return vals.sort((a,b)=>b-a);
}
// 副花色数组
function subSuits(cards, type, area) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  const suits = cards.map(c => c.split('_')[2]);
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
  let main;
  if (type === "三条" || type === "铁支" || type === "对子") {
    main = Number(Object.entries(cnt).sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0]);
    const arr = [];
    cards.forEach(c => {
      const v = VALUE_ORDER[c.split('_')[0]];
      if (v !== main) arr.push(SUIT_ORDER[c.split('_')[2]]);
    });
    return arr.sort((a,b)=>b-a);
  }
  if (type === "葫芦") {
    main = Number(Object.entries(cnt).find(e=>e[1]===3)[0]);
    return cards.filter(c=>VALUE_ORDER[c.split('_')[0]]!==main).map(c=>SUIT_ORDER[c.split('_')[2]]).sort((a,b)=>b-a);
  }
  return suits.map(s=>SUIT_ORDER[s]).sort((a,b)=>b-a);
}

// Helper: 判断顺子
function isStraight(cards) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  return isStraightVals(vals);
}
function isStraightVals(vals) {
  const uniq = Array.from(new Set(vals));
  if (uniq.length !== vals.length) return false;
  uniq.sort((a,b)=>a-b);
  if (uniq[uniq.length-1]-uniq[0]===uniq.length-1) return true;
  // A2345
  if (JSON.stringify(uniq)==='[2,3,4,5,14]') return true;
  return false;
}
function isSameSuit(arr) {
  return arr.map(c => c.split('_')[2]).every(s => s === arr[0].split('_')[2]);
}
function isSameSuitArr(suitsArr) {
  return suitsArr.every(s => s === suitsArr[0]);
}
function isStraightFlush(cards) {
  return isSameSuit(cards) && isStraight(cards);
}
