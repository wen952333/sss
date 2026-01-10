import { Card, PlayerHand } from "../types";

export const getBestArrangement = async (cards: Card[]): Promise<PlayerHand[] | null> => {
  try {
    const response = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards }),
    });

    if (!response.ok) throw new Error(response.statusText);

    const data = await response.json();
    // API now returns { suggestions: PlayerHand[] }
    return data.suggestions as PlayerHand[];

  } catch (error) {
    console.error("AI Request Failed:", error);
    return null;
  }
};