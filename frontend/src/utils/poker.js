export const suits = ["spades", "hearts", "clubs", "diamonds"];
export const values = [
  "ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"
];

export function getCardImage(value, suit) {
  return `/cards/${value}_of_${suit}.svg`;
}

export function getCardName(card) {
  // card: {value: '10', suit: 'clubs'}
  let v = card.value.toLowerCase();
  let s = card.suit.toLowerCase();
  return `${v}_of_${s}.svg`
}
