// 扑克牌英文与花色映射
export const suitMap = {
  'spades': '黑桃',
  'hearts': '红桃',
  'diamonds': '方块',
  'clubs': '梅花',
};

export const valueMap = {
  'ace': 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'jack': 'J',
  'queen': 'Q',
  'king': 'K',
};

/**
 * 获取扑克牌图片路径
 * @param {string} value 牌面值，如'A', '10', 'J'
 * @param {string} suit 花色，如'黑桃', '红桃'
 */
export function getCardImage(value, suit) {
  let suitKey = Object.keys(suitMap).find(key => suitMap[key] === suit);
  let valueKey = Object.keys(valueMap).find(key => valueMap[key] === value);
  if (!suitKey || !valueKey) return '';
  return `/cards/${valueKey}_of_${suitKey}.svg`;
}
