// DealCards.js - 十三水前端发牌/洗牌模块（修复：发牌绝无重复，所有好牌保证唯一）

const allSuits = ['clubs', 'spades', 'diamonds', 'hearts'];
const allRanks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];

// 生成一副标准牌
function makeFullDeck() {
  const deck = [];
  for (const suit of allSuits) for (const rank of allRanks) deck.push(`${rank}_of_${suit}`);
  return deck;
}

// 校验一副牌全唯一
function assertNoDuplicate(deck) {
  const seen = new Set();
  for (const card of deck) {
    if (seen.has(card)) throw new Error('有重复牌: ' + card);
    seen.add(card);
  }
  if (deck.length !== 52) throw new Error('牌数量不是52: ' + deck.length);
}

// ---------- 多种好牌生成函数，确保互不重复且全唯一 ----------

// 一条龙（A~K不同花色）
function makeDragonHand() {
  return [
    '2_of_spades','3_of_clubs','4_of_hearts','5_of_diamonds','6_of_clubs',
    '7_of_spades','8_of_diamonds','9_of_hearts','10_of_clubs','jack_of_spades',
    'queen_of_diamonds','king_of_hearts','ace_of_spades'
  ];
}

// 三顺子（不同牌型）
function makeThreeStraightHand1() {
  // 5-6-7, 8-9-10-J-Q, K-A-2-3-4
  return [
    '5_of_spades','6_of_hearts','7_of_clubs',
    '8_of_clubs','9_of_spades','10_of_hearts','jack_of_clubs','queen_of_hearts',
    'king_of_spades','ace_of_hearts','2_of_diamonds','3_of_clubs','4_of_spades'
  ];
}
function makeThreeStraightHand2() {
  // 6-7-8, 9-10-J-Q-K, A-2-3-4-5
  return [
    '6_of_spades','7_of_hearts','8_of_clubs',
    '9_of_diamonds','10_of_spades','jack_of_hearts','queen_of_clubs','king_of_diamonds',
    'ace_of_clubs','2_of_hearts','3_of_diamonds','4_of_clubs','5_of_hearts'
  ];
}

// 铁支（炸弹）和同花顺（不同点/花色）
function makeBombHand1() {
  // 9炸弹+同花顺
  return [
    '9_of_spades','9_of_hearts','9_of_diamonds','9_of_clubs',
    '10_of_hearts','jack_of_hearts','queen_of_hearts','king_of_hearts','ace_of_hearts',
    '2_of_spades','3_of_clubs','4_of_diamonds','5_of_hearts'
  ];
}
function makeBombHand2() {
  // 7炸弹+同花顺（注意不要重复7_of_clubs）
  return [
    '7_of_spades','7_of_hearts','7_of_diamonds','7_of_clubs',
    '3_of_clubs','4_of_clubs','5_of_clubs','6_of_clubs','8_of_clubs',
    '10_of_hearts','jack_of_spades','queen_of_diamonds','king_of_diamonds'
  ];
}

// 六对半（不同组合）
function makeSixPairsHand1() {
  return [
    '2_of_spades','2_of_hearts',
    '3_of_clubs','3_of_diamonds',
    '4_of_hearts','4_of_clubs',
    '5_of_clubs','5_of_diamonds',
    '6_of_spades','6_of_hearts',
    '7_of_clubs','7_of_hearts',
    'ace_of_spades'
  ];
}
function makeSixPairsHand2() {
  return [
    '8_of_spades','8_of_hearts',
    '9_of_clubs','9_of_diamonds',
    '10_of_hearts','10_of_clubs',
    'jack_of_clubs','jack_of_diamonds',
    'queen_of_spades','queen_of_hearts',
    'king_of_clubs','king_of_hearts',
    '3_of_spades'
  ];
}

// 三同花（不同花色）
function makeThreeFlushHand1() {
  // 头梅花，中方块，尾黑桃
  return [
    '2_of_clubs','3_of_clubs','4_of_clubs',
    '5_of_diamonds','6_of_diamonds','7_of_diamonds','8_of_diamonds','9_of_diamonds',
    '10_of_spades','jack_of_spades','queen_of_spades','king_of_spades','ace_of_spades'
  ];
}
function makeThreeFlushHand2() {
  // 头红桃，中梅花，尾方块
  return [
    '2_of_hearts','3_of_hearts','4_of_hearts',
    '5_of_clubs','6_of_clubs','7_of_clubs','8_of_clubs','9_of_clubs',
    '10_of_diamonds','jack_of_diamonds','queen_of_diamonds','king_of_diamonds','ace_of_diamonds'
  ];
}

// ------- 所有好牌生成函数集合(互不重叠) --------
const patterns = [
  makeDragonHand,
  makeThreeStraightHand1,
  makeThreeStraightHand2,
  makeBombHand1,
  makeBombHand2,
  makeSixPairsHand1,
  makeSixPairsHand2,
  makeThreeFlushHand1,
  makeThreeFlushHand2
];

// 修复核心：确保无论好牌还是随机，都绝无重复
export function getShuffledDeck() {
  const deck = makeFullDeck();
  const useGoodHand = Math.random() < 0.4;
  let goodHand = null;
  if (useGoodHand) {
    const idx = Math.floor(Math.random() * patterns.length);
    goodHand = patterns[idx]();
    // 检查好牌本身无重复
    assertNoDuplicate(goodHand);
  }
  // 从全牌中剔除好牌，剩余洗牌
  const left = goodHand ? deck.filter(card => !goodHand.includes(card)) : [...deck];
  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  // 合成最终发牌
  const finalDeck = goodHand ? [...goodHand, ...left] : left;
  assertNoDuplicate(finalDeck);
  return finalDeck;
}

// 一次性发4家，每家13张
export function dealHands(deck = getShuffledDeck()) {
  if (deck.length !== 52) throw new Error('发牌总数不是52');
  return [
    deck.slice(0, 13),
    deck.slice(13, 26),
    deck.slice(26, 39),
    deck.slice(39, 52)
  ];
}

// ========== 自定义发特定牌型 ==========
// 返回一个定制的4家牌型（如：第0家三顺子，第1家一条龙等）
export function dealCustomHands({ player0, player1, player2, player3 }) {
  let used = [];
  const all = makeFullDeck();

  // 优先使用自定义（务必保证自定义牌无重复）
  let hands = [player0, player1, player2, player3].map(arr => arr ? [...arr] : []);
  used = hands.flat();
  // 检查自定义部分无重复
  assertNoDuplicate(used);

  // 补足未指定的手牌
  let left = all.filter(card => !used.includes(card));
  for (let i = 0; i < 4; ++i) {
    while (hands[i].length < 13 && left.length > 0) {
      hands[i].push(left.pop());
    }
  }
  // 检查最终四家无重复
  assertNoDuplicate(hands.flat());
  return hands;
}

// 导出所有好牌生成函数，方便试玩自定义
export {
  makeDragonHand,
  makeThreeStraightHand1,
  makeThreeStraightHand2,
  makeBombHand1,
  makeBombHand2,
  makeSixPairsHand1,
  makeSixPairsHand2,
  makeThreeFlushHand1,
  makeThreeFlushHand2
};
