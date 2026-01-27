import { GoogleGenAI, Type } from "@google/genai";
import { Card, Move, HandType } from '../types';

// NOTE: In a real Cloudflare Pages Function app, this would be a server-side call.
// Here we simulate it on client for demonstration, assuming API_KEY is available.
// If API_KEY is not set, we mock the response.

const getCardString = (cards: Card[]) => cards.map(c => c.label + c.suit).join(',');

export const getSmartHint = async (
  playerHand: Card[],
  lastMove: Move | null,
  landlordCards: Card[],
  myRole: string
): Promise<string> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "请在 .env 中配置 Gemini API Key 以使用 AI 提示功能。";
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    你是一位斗地主（Dou Dizhu）游戏的高手。
    
    上下文:
    我的角色: ${myRole}
    我的手牌: [${getCardString(playerHand)}]
    
    当前牌桌状态:
    上家出的牌: ${lastMove ? getCardString(lastMove.cards) : "无 (新的一轮)"}
    ${lastMove ? `牌型: ${lastMove.type}` : ""}
    地主明牌 (如果可见): [${getCardString(landlordCards)}]
    
    任务:
    分析我的手牌和当前局势。给我一个最好的出牌建议。
    如果建议“过”（不出牌），请解释原因。
    如果建议出牌，列出具体要出的牌。
    请保持回答简短、具有战略性（不超过2句话），使用中文回答。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "你是一个简洁的斗地主战略顾问。请用中文回答。",
        temperature: 0.2, // Low temp for more logical play
      }
    });
    
    return response.text || "AI 暂时无法生成建议。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 不可用 (请检查 API Key)";
  }
};