export const suits = ["spades", "hearts", "clubs", "diamonds"];
export const values = [
  "ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"
];

export function getCardImage(value, suit) {
  return `/cards/${value}_of_${suit}.svg`;
}
