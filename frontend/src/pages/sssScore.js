// sssScore.js - 十三水比牌计分（严格后端规则，支持倒水投降处理）
// 支持：倒水等于投降，三道都输给所有玩家并且按赢家三道分数扣分，特殊牌型、普通比牌都支持

// 牌面大小映射
const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
};
const SUIT_ORDER = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 };

// 计算所有玩家分数（支持倒水投降扣分）
export function calcSSSAllScores(players) {
  // players: [{head, middle, tail, name}, ...]
  const N = players.length;
  let marks = new Array(N).fill(0);

  // 先判断倒水
  const fouls = players.map(p => isFoul(p.head, p.middle, p.tail));

  // 特殊牌型判定
  const specials = players.map((p, idx) => fouls[idx] ? null : getSpecialType(p));
  const specialRanks = specials.map(s => s ? specialTypeRank(s) : 0);

  // 统计每家三道分数（用于倒水扣分）
  const threeScores = players.map((p, idx) => fouls[idx] ? 0 : (
    getAreaScore(p.head, 'head') +
    getAreaScore(p.middle, 'middle') +
    getAreaScore(p.tail, 'tail')
  ));

  // 倒水处理：自己输给每家，按对方三道分数扣分，对方加分
  for (let i = 0; i < N; ++i) {
    if (fouls[i]) {
      let lose = 0;
      for (let j = 0; j < N; ++j) {
        if (i === j) continue;
        marks[j] += threeScores[j];
        lose += threeScores[j];
      }
      marks[i] -= lose;
    }
  }

  // 正常比牌
  for (let i = 0; i < N; ++i) {
    if (fouls[i]) continue;
    for (let j = i + 1; j < N; ++j) {
      if (fouls[j]) continue;
      // 特殊牌型优先
      if (specials[i] && !specials[j]) {
        marks[i] += 3;
        marks[j] -= 3;
        continue;
      }
      if (!specials[i] && specials[j]) {
        marks[i] -= 3;
        marks[j] += 3;
        continue;
      }
      if (specials[i] && specials[j]) {
        if (specialRanks[i] > specialRanks[j]) {
          marks[i] += 3; marks[j] -= 3;
        }
        else if (specialRanks[i] < specialRanks[j]) {
          marks[i] -= 3; marks[j] += 3;
        }
        continue;
      }
      // 普通三道比牌
      let winA = 0, winB = 0;
      if (compareArea(players[i].head, players[j].head, 'head') > 0) winA++; else winB++;
      if (compareArea(players[i].middle, players[j].middle, 'middle') > 0) winA++; else winB++;
      if (compareArea(players[i].tail, players[j].tail, 'tail') > 0) winA++; else winB++;
      if (winA === 3) {
        // 全赢，加自己三道分数
        let add = getAreaScore(players[i].head, 'head') +
                  getAreaScore(players[i].middle, 'middle') +
                  getAreaScore(players[i].tail, 'tail');
        marks[i] += add;
        marks[j] -= add;
      } else if (winB === 3) {
        let add = getAreaScore(players[j].head, 'head') +
                  getAreaScore(players[j].middle, 'middle') +
                  getAreaScore(players[j].tail, 'tail');
        marks[i] -= add;
        marks[j] += add;
      } else {
        // 普通道数比分
        marks[i] += winA - winB;
        marks[j] += winB - winA;
      }
    }
  }
  return marks;
}

// 倒水（三道强度不依次递增）
function isFoul(head, middle, tail) {
  const headRank = areaTypeRank(getAreaType(head, 'head'), 'head');
  const midRank = areaTypeRank(getAreaType(middle, 'middle'), 'middle');
  const tailRank = areaTypeRank(getAreaType(tail, 'tail'), 'tail');
  return !(headRank <= midRank && midRank <= tailRank);
}

// 特殊牌型识别
function getSpecialType(p) {
  const all = [...p.head, ...p.middle, ...p.tail];
  const suits = all.map(c => c.split('_')[2]);
  const uniqVals = new Set(all.map(c => c.split('_')[0]));
  // 一条龙
  if (uniqVals.size === 13) return '一条龙';
  // 六对半
  const valueCount = {};
  all.forEach(c => {
    const v = c.split('_')[0];
    valueCount[v] = (valueCount[v] || 0) + 1;
  });
  let pairs = 0, four = 0;
  Object.values(valueCount).forEach(cnt => {
    if (cnt === 4) four++;
    if (cnt === 2) pairs++;
  });
  if (pairs === 6 && Object.values(valueCount).includes(1)) return '六对半';
  // 三同花（严格要求三墩花色完全一致且三墩花色不同）
  const hSuit = p.head[0].split('_')[2];
  const mSuit = p.middle[0].split('_')[2];
  const tSuit = p.tail[0].split('_')[2];
  if (p.head.every(c => c.split('_')[2] === hSuit) &&
      p.middle.every(c => c.split('_')[2] === mSuit) &&
      p.tail.every(c => c.split('_')[2] === tSuit) &&
      hSuit !== mSuit && hSuit !== tSuit && mSuit !== tSuit) {
    return '三同花';
  }
  // 三顺子（每道均为顺子）
  if (isStraight(p.head) && isStraight(p.middle) && isStraight(p.tail)) return '三顺子';
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

// 单墩比大小
function compareArea(a, b, area) {
  const typeA = getAreaType(a, area);
  const typeB = getAreaType(b, area);
  const typeRankA = areaTypeRank(typeA, area);
  const typeRankB = areaTypeRank(typeB, area);
  if (typeRankA !== typeRankB) return typeRankA > typeRankB ? 1 : -1;
  // 点数
  const valsA = a.map(c => VALUE_ORDER[c.split('_')[0]]).sort((x, y) => y - x);
  const valsB = b.map(c => VALUE_ORDER[c.split('_')[0]]).sort((x, y) => y - x);
  for (let i = 0; i < valsA.length; ++i) {
    if (valsA[i] > valsB[i]) return 1;
    if (valsA[i] < valsB[i]) return -1;
  }
  // 花色
  const suitsA = a.map(c => SUIT_ORDER[c.split('_')[2]]).sort((x, y) => y - x);
  const suitsB = b.map(c => SUIT_ORDER[c.split('_')[2]]).sort((x, y) => y - x);
  for (let i = 0; i < suitsA.length; ++i) {
    if (suitsA[i] > suitsB[i]) return 1;
    if (suitsA[i] < suitsB[i]) return -1;
  }
  return 0;
}

// 墩类型和强度
function getAreaType(cards, area) {
  const vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
  if (area === 'head') {
    if (Object.values(cnt).includes(3)) return "三条";
    if (Object.values(cnt).includes(2)) return "对子";
    return "高牌";
  }
  if (Object.values(cnt).includes(4)) return "铁支";
  if (isFlush(cards) && isStraight(cards)) return "同花顺";
  if (Object.values(cnt).includes(3) && Object.values(cnt).includes(2)) return "葫芦";
  if (isFlush(cards)) return "同花";
  if (isStraight(cards)) return "顺子";
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

// 每道分数（用于冲关、倒水计分）
function getAreaScore(cards, area) {
  const type = getAreaType(cards, area);
  if (area === 'head') {
    if (type === "三条") return 3;
    if (type === "对子") return 1;
    return 1;
  }
  if (type === "铁支") return 5;
  if (type === "同花顺") return 5;
  if (type === "葫芦") return 2;
  if (type === "同花") return 1;
  if (type === "顺子") return 1;
  if (type === "三条") return 1;
  if (type === "两对") return 1;
  if (type === "对子") return 1;
  return 1;
}

// 顺子/同花辅助
function isStraight(cards) {
  let vals = cards.map(c => VALUE_ORDER[c.split('_')[0]]);
  vals = [...new Set(vals)].sort((a, b) => a - b);
  if (vals.length !== cards.length) return false;
  if (vals[vals.length - 1] - vals[0] === vals.length - 1) return true;
  // A2345特例
  if (JSON.stringify(vals) === JSON.stringify([2,3,4,5,14])) return true;
  return false;
}
function isFlush(cards) {
  return cards.every(c => c.split('_')[2] === cards[0].split('_')[2]);
}
