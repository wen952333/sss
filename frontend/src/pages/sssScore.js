// sssScore.js - 十三水比牌计分（各道分数制，两两结算，每对只算一次，符合你要的规则）

const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
};
const SUIT_ORDER = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 };

// 计算所有玩家分数（每对只结算一次！）
export function calcSSSAllScores(players) {
  // players: [{head, middle, tail, name}, ...]
  const N = players.length;
  let marks = new Array(N).fill(0);

  // 倒水判定
  const fouls = players.map(p => isFoul(p.head, p.middle, p.tail));
  // 特殊牌型（只对未倒水玩家有效）
  const specials = players.map((p, idx) => fouls[idx] ? null : getSpecialType(p));
  const specialRanks = specials.map(s => s ? specialTypeRank(s) : 0);

  // 统计每家三道分数（用于倒水结算）
  const threeScores = players.map((p, idx) => (
    getAreaScore(p.head, 'head') +
    getAreaScore(p.middle, 'middle') +
    getAreaScore(p.tail, 'tail')
  ));

  // 每对玩家只结算一次（i < j），不会重复
  for (let i = 0; i < N; ++i) {
    for (let j = i + 1; j < N; ++j) {
      // 倒水处理
      if (fouls[i] && !fouls[j]) {
        marks[i] -= threeScores[j];
        marks[j] += threeScores[j];
        continue;
      }
      if (!fouls[i] && fouls[j]) {
        marks[i] += threeScores[i];
        marks[j] -= threeScores[i];
        continue;
      }
      if (fouls[i] && fouls[j]) continue;

      // 特殊牌型判定
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
        } else if (specialRanks[i] < specialRanks[j]) {
          marks[i] -= 3; marks[j] += 3;
        }
        continue;
      }

      // 普通三道比牌
      let areaNames = ['head', 'middle', 'tail'];
      for (let k = 0; k < 3; ++k) {
        let cmp = compareArea(players[i][areaNames[k]], players[j][areaNames[k]], areaNames[k]);
        if (cmp > 0) {
          let add = getAreaScore(players[i][areaNames[k]], areaNames[k]);
          marks[i] += add;
          marks[j] -= add;
        } else if (cmp < 0) {
          let add = getAreaScore(players[j][areaNames[k]], areaNames[k]);
          marks[i] -= add;
          marks[j] += add;
        }
        // 平局不加减（但实际比牌逻辑已几乎不可能平局）
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

// 特殊牌型识别（倒水玩家不会调用此函数）
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
  // 三同花（三墩各自同花，且三墩花色可以相同或不同）
  const hSuit = p.head[0].split('_')[2];
  const mSuit = p.middle[0].split('_')[2];
  const tSuit = p.tail[0].split('_')[2];
  if (p.head.every(c => c.split('_')[2] === hSuit) &&
      p.middle.every(c => c.split('_')[2] === mSuit) &&
      p.tail.every(c => c.split('_')[2] === tSuit)) {
    // 尾道为同花顺不算三同花
    if (!(isStraight(p.tail) && p.tail.every(c => c.split('_')[2] === tSuit))) {
      return '三同花';
    }
  }
  // 三顺子（每道均为顺子，尾道为同花顺不算三顺子）
  if (isStraight(p.head) && isStraight(p.middle) && isStraight(p.tail)) {
    if (!(isStraight(p.tail) && p.tail.every(c => c.split('_')[2] === tSuit))) {
      return '三顺子';
    }
  }
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
  const valsA = a.map(c => VALUE_ORDER[c.split('_')[0]]).sort((x, y) => y - x);
  const valsB = b.map(c => VALUE_ORDER[c.split('_')[0]]).sort((x, y) => y - x);
  for (let i = 0; i < valsA.length; ++i) {
    if (valsA[i] > valsB[i]) return 1;
    if (valsA[i] < valsB[i]) return -1;
  }
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

// 每道分数
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
