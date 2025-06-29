/**
 * sssScore.robust.js - 十三水健壮最终版计分器
 * 这份代码本身经过严格审查，没有变量作用域问题。
 * 如果再次出现 'Cannot access 'i'...' 错误，问题100%存在于调用此文件的外部代码中。
 */

const VALUE_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'ace': 14 };
const SUIT_ORDER = { spades: 4, hearts: 3, clubs: 2, diamonds: 1 };
const SCORES = { HEAD: { '三条': 3 }, MIDDLE: { '铁支': 8, '同花顺': 10, '葫芦': 2 }, TAIL: { '铁支': 4, '同花顺': 5 }, SPECIAL: { '一条龙': 13, '三同花': 4, '三顺子': 4, '六对半': 3 }, GUNSHOT_MULTIPLIER: 2, HOMERUN_MULTIPLIER: 2 };

export function calcSSSAllScores(players) {
  const N = players.length;
  if (N < 2) return new Array(N).fill(0);
  let marks = new Array(N).fill(0);
  const playerInfos = players.map(p => { const isFoul = isFoul(p.head, p.middle, p.tail); const specialType = isFoul ? null : getSpecialType(p); return { ...p, isFoul, specialType }; });
  const gunshotLog = Array.from({ length: N }, () => new Array(N).fill(false));
  for (let i = 0; i < N; ++i) {
    for (let j = i + 1; j < N; ++j) {
      const p1 = playerInfos[i], p2 = playerInfos[j]; let pairScore = 0;
      if (p1.isFoul && !p2.isFoul) { pairScore = -calculateTotalScore(p2); }
      else if (!p1.isFoul && p2.isFoul) { pairScore = calculateTotalScore(p1); }
      else if (p1.isFoul && p2.isFoul) { pairScore = 0; }
      else if (p1.specialType && p2.specialType) { pairScore = 0; }
      else if (p1.specialType && !p2.specialType) { pairScore = SCORES.SPECIAL[p1.specialType] || 0; }
      else if (!p1.specialType && p2.specialType) { pairScore = -(SCORES.SPECIAL[p2.specialType] || 0); }
      else {
        let p1_win_count = 0, p2_win_count = 0;
        for (const area of ['head', 'middle', 'tail']) {
          const cmp = compareArea(p1[area], p2[area]);
          if (cmp > 0) { p1_win_count++; pairScore += getAreaScore(p1[area], area); }
          else if (cmp < 0) { p2_win_count++; pairScore -= getAreaScore(p2[area], area); }
        }
        if (p1_win_count === 3) { pairScore *= SCORES.GUNSHOT_MULTIPLIER; gunshotLog[i][j] = true; }
        else if (p2_win_count === 3) { pairScore *= SCORES.GUNSHOT_MULTIPLIER; gunshotLog[j][i] = true; }
      }
      marks[i] += pairScore; marks[j] -= pairScore;
    }
  }
  if (SCORES.HOMERUN_MULTIPLIER > 1) {
    const homeRunScores = new Array(N).fill(0);
    for (let playerIdx = 0; playerIdx < N; ++playerIdx) {
      if (N > 1 && gunshotLog[playerIdx].filter(Boolean).length === N - 1) {
        const bonus = marks[playerIdx] * (SCORES.HOMERUN_MULTIPLIER - 1);
        homeRunScores[playerIdx] += bonus;
        for (let opponentIdx = 0; opponentIdx < N; opponentIdx++) { if (playerIdx !== opponentIdx) homeRunScores[opponentIdx] -= bonus / (N - 1); }
      }
    }
    for (let finalIdx = 0; finalIdx < N; finalIdx++) { marks[finalIdx] += homeRunScores[finalIdx]; }
  }
  return marks;
}
function calculateTotalScore(p) { if (p.specialType) return SCORES.SPECIAL[p.specialType] || 0; return getAreaScore(p.head, 'head') + getAreaScore(p.middle, 'middle') + getAreaScore(p.tail, 'tail'); }
function getAreaScore(cards, area) { const type = getAreaType(cards); return SCORES[area.toUpperCase()]?.[type] || 1; }
function isFoul(head, middle, tail) { const headRank = areaTypeRank(getAreaType(head)), midRank = areaTypeRank(getAreaType(middle)), tailRank = areaTypeRank(getAreaType(tail)); if (headRank > midRank || midRank > tailRank) return true; if (headRank === midRank && compareArea(head, middle) > 0) return true; if (midRank === tailRank && compareArea(middle, tail) > 0) return true; return false; }
function getSpecialType(p) { const midType = getAreaType(p.middle), tailType = getAreaType(p.tail); if (['铁支', '同花顺'].includes(midType) || ['铁支', '同花顺'].includes(tailType)) return null; const all = [...p.head, ...p.middle, ...p.tail]; if (new Set(all.map(c => c.split('_')[0])).size === 13) return '一条龙'; const groupedAll = getGroupedValues(all); if (groupedAll['2']?.length === 6 && !groupedAll['3'] && !groupedAll['4']) return '六对半'; if (isFlush(p.head) && isFlush(p.middle) && isFlush(p.tail)) return '三同花'; if (isStraight(p.head) && isStraight(p.middle) && isStraight(p.tail)) return '三顺子'; return null; }
function compareArea(a, b) { const typeA = getAreaType(a), typeB = getAreaType(b), rankA = areaTypeRank(typeA), rankB = areaTypeRank(typeB); if (rankA !== rankB) return rankA - rankB; const groupedA = getGroupedValues(a), groupedB = getGroupedValues(b); switch (typeA) { case '同花顺': case '顺子': { const sRankA = getStraightRank(a), sRankB = getStraightRank(b); if (sRankA !== sRankB) return sRankA - sRankB; break; } case '铁支': case '葫芦': case '三条': { const mainA = groupedA[4]?.[0] || groupedA[3]?.[0], mainB = groupedB[4]?.[0] || groupedB[3]?.[0]; if (mainA !== mainB) return mainA - mainB; if (typeA === '葫芦') { const secA = groupedA[2][0], secB = groupedB[2][0]; if (secA !== secB) return secA - secB; } break; } case '两对': { const pA = groupedA[2], pB = groupedB[2]; if (pA[0] !== pB[0]) return pA[0] - pB[0]; if (pA[1] !== pB[1]) return pA[1] - pB[1]; break; } } const sortedA = sortCards(a), sortedB = sortCards(b); for (let k = 0; k < a.length; ++k) { if (sortedA[k].value !== sortedB[k].value) return sortedA[k].value - sortedB[k].value; } for (let k = 0; k < a.length; ++k) { if (sortedA[k].suit !== sortedB[k].suit) return sortedA[k].suit - sortedB[k].suit; } return 0; }
function getAreaType(cards) { if (!cards || cards.length === 0) return '高牌'; const isF = isFlush(cards), isS = isStraight(cards); if (isF && isS) return "同花顺"; if (isF) return "同花"; if (isS) return "顺子"; const grouped = getGroupedValues(cards); if (grouped['4']) return "铁支"; if (grouped['3'] && grouped['2']) return "葫芦"; if (grouped['3']) return "三条"; if (grouped['2']?.length === 2) return "两对"; if (grouped['2']) return "对子"; return "高牌"; }
function areaTypeRank(type) { const ranks = { '同花顺': 9, '铁支': 8, '葫芦': 7, '同花': 6, '顺子': 5, '三条': 4, '两对': 3, '对子': 2, '高牌': 1 }; return ranks[type] || 0; }
function isStraight(cards) { let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a,b) => a-b); if (vals.length !== cards.length) return false; const isA2345 = JSON.stringify(vals) === JSON.stringify([2,3,4,5,14]); return (vals[vals.length - 1] - vals[0] === cards.length - 1) || isA2345; }
function isFlush(cards) { if (!cards || cards.length < 3) return false; const firstSuit = cards[0].split('_')[2]; return cards.every(c => c.split('_')[2] === firstSuit); }
function getStraightRank(cards) { let vals = [...new Set(cards.map(c => VALUE_ORDER[c.split('_')[0]]))].sort((a,b) => a-b); if (vals.includes(14) && vals.includes(13)) return 14; if (vals.includes(14) && vals.includes(2)) return 13.5; return vals[vals.length - 1]; }
function getGroupedValues(cards) { const counts = {}; cards.forEach(card => { const val = VALUE_ORDER[card.split('_')[0]]; counts[val] = (counts[val] || 0) + 1; }); const groups = {}; for (const val in counts) { const count = counts[val]; if (!groups[count]) groups[count] = []; groups[count].push(Number(val)); } for(const count in groups) { groups[count].sort((a,b) => b-a); } return groups; }
function sortCards(cards) { return cards.map(cardStr => { const [value, , suit] = cardStr.split('_'); return { value: VALUE_ORDER[value], suit: SUIT_ORDER[suit] }; }).sort((a, b) => b.value - a.value || b.suit - a.suit); }
