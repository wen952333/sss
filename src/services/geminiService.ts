
import { CardType } from "../types";

export const getSuggestedHandArrangement = async (cards: CardType[]) => {
  try {
    const response = await fetch('/api/game/arrange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cards }),
    });

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(err.error || 'Failed to get arrangement');
    }

    const data = await response.json();
    return data; 
  } catch (error) {
    console.error("Arrangement Service Error:", error);
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    return {
      back: sorted.slice(0, 5),
      middle: sorted.slice(5, 10),
      front: sorted.slice(10, 13),
      reasoning: "网络错误，已使用默认排序"
    };
  }
};
