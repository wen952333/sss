// 获取扑克牌图片文件名
export const getCardImage = (rank, suit) => {
  let rankName = rank.toLowerCase();
  const suitName = suit.toLowerCase();
  
  // 转换数字和字母
  if (rankName === '1' || rankName === 'a') rankName = 'ace';
  if (rankName === 'k') rankName = 'king';
  if (rankName === 'q') rankName = 'queen';
  if (rankName === 'j') rankName = 'jack';
  
  return `${rankName}_of_${suitName}.svg`;
};

// 生成标准扑克牌组
export const generateDeck = () => {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  const deck = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({ 
        rank, 
        suit, 
        image: getCardImage(rank, suit) 
      });
    });
  });
  
  return deck;
};

// 洗牌算法
export const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 计算牌型分数
export const calculateHandScore = (cards) => {
  // 这里简化处理，实际游戏需要复杂的牌型判断
  return cards.length; // 示例分数
};
