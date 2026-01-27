import { Card, Move } from '../types';

const getCardString = (cards: Card[]) => cards.map(c => c.label + c.suit).join(',');

export const getSmartHint = async (
  playerHand: Card[],
  lastMove: Move | null,
  landlordCards: Card[],
  myRole: string
): Promise<string> => {
  
  try {
    // 构建请求数据
    const payload = {
      playerHand: getCardString(playerHand),
      lastMove: lastMove ? getCardString(lastMove.cards) : "无 (新的一轮)",
      lastMoveType: lastMove ? lastMove.type : "",
      landlordCards: getCardString(landlordCards),
      myRole
    };

    // 调用 Cloudflare Pages Function (后端 API)
    // 这样可以隐藏 API KEY，并且利用 Cloudflare 的网络环境访问 Google，
    // 同时如果 Gemini 挂了，后端会自动切换到 Cloudflare AI。
    const response = await fetch('/api/ai-hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.hint || "军师正在思考...";

  } catch (error) {
    console.error("AI Hint Error:", error);
    return "军师暂时掉线了 (请检查网络或配置)";
  }
};