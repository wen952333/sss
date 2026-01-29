
import { GoogleGenAI, Type } from "@google/genai";
import { CardType } from "../types";
import { formatHandForPrompt } from "../utils/pokerLogic";

// Initialize Gemini Client
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Strategies to rotate through to ensure variety
const STRATEGIES = [
  "Maximize the strength of the Back hand (highest wins).",
  "Maximize the strength of the Front hand (head start).",
  "Try to make a special pattern (All small, All big, 6 pairs) if possible, otherwise balanced.",
  "Focus on a strong Middle hand.",
  "Balanced defense strategy."
];

export const getSuggestedHandArrangement = async (cards: CardType[]) => {
  const ai = getAiClient();
  if (!ai) throw new Error("API Key not configured");

  const handString = formatHandForPrompt(cards);
  
  // Pick a random strategy focus to ensure variety on button clicks
  const randomStrategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];

  const prompt = `
    You are a grandmaster Chinese Poker (Shisanshui) player.
    I have these 13 cards: ${handString}.
    
    Task: Arrange these into Front (3), Middle (5), Back (5).
    Rules: Front < Middle < Back (in hand strength).
    
    Current Strategic Focus: ${randomStrategy}
    
    Requirements:
    1. STRICTLY follow the Front < Middle < Back rule.
    2. Use EXACT card formats from input (e.g. "A♠", "10♥").
    3. Return a valid JSON.

    Schema:
    {
      "front": ["card", "card", "card"],
      "middle": ["card", ...],
      "back": ["card", ...],
      "reasoning": "Brief strategy name (e.g. 'Flush Back', 'Three Straights')"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.9, // Higher temperature for variety
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.ARRAY, items: { type: Type.STRING } },
            middle: { type: Type.ARRAY, items: { type: Type.STRING } },
            back: { type: Type.ARRAY, items: { type: Type.STRING } },
            reasoning: { type: Type.STRING },
          },
          required: ["front", "middle", "back", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Hand Suggestion Error:", error);
    throw error;
  }
};
