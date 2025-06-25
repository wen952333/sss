// 用于将牌面(如 '10C'、'AS'、'KD'、'QH'、'JS')映射到SVG文件名

const suitMap = {
  'C': 'clubs',
  'D': 'diamonds',
  'H': 'hearts',
  'S': 'spades'
};

export function getCardImage(card) {
  // card 例如 '10C', 'AS', 'KD', 'QH', 'JS'
  let rank = card.slice(0, -1);
  let suit = card.slice(-1);

  // 处理JQK/A
  if (rank === 'A') rank = 'ace';
  else if (rank === 'J') rank = 'jack';
  else if (rank === 'Q') rank = 'queen';
  else if (rank === 'K') rank = 'king';
  else rank = rank; // 2-10

  return `/cards/${rank}_of_${suitMap[suit]}.svg`;
}
