import { GoogleGenAI } from "@google/genai";

// Define PagesFunction type locally since @cloudflare/workers-types might be missing
type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}) => Promise<Response>;

interface Env {
  GEMINI_API_KEY: string;
  AI: any; // Cloudflare Workers AI binding
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();
    const { playerHand, lastMove, lastMoveType, landlordCards, myRole } = body;

    // 构造提示词
    const systemPrompt = "你是一位斗地主（Dou Dizhu）游戏的高手战略顾问。请用中文回答，建议必须简短（不超过30字），直接告诉玩家出什么牌或者'过'，并简述理由。";
    const userPrompt = `
      我的角色: ${myRole}
      我的手牌: [${playerHand}]
      上家出的牌: ${lastMove} (${lastMoveType})
      地主明牌: [${landlordCards}]
      
      请给出最佳出牌建议。
    `;

    let hintText = "";
    let usedModel = "";

    // --- 策略 1: 优先尝试 Google Gemini ---
    if (env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        // 使用 Flash 模型，速度快且免费额度高
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview", 
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1, // 降低随机性，提高逻辑准确性
          }
        });
        hintText = response.text || "";
        usedModel = "Gemini";
      } catch (geminiError) {
        console.error("Gemini API failed, switching to fallback:", geminiError);
      }
    }

    // --- 策略 2: 如果 Gemini 失败或未配置，使用 Cloudflare Workers AI (备用) ---
    if (!hintText && env.AI) {
      try {
        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ];
        
        // 使用 Llama 3 或其他高性能模型
        const response: any = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages });
        
        // Cloudflare AI 返回格式可能不同，通常是 response.response
        hintText = response.response || JSON.stringify(response);
        usedModel = "Cloudflare AI (Llama-3)";
      } catch (cfError) {
        console.error("Cloudflare AI failed:", cfError);
      }
    }

    if (!hintText) {
      return new Response(JSON.stringify({ hint: "军师此时也拿不准主意..." }), { 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 添加一点标识让用户知道是谁在服务(可选，调试用)
    // hintText += ` (${usedModel})`;

    return new Response(JSON.stringify({ hint: hintText }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};