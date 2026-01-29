
interface Card {
  id: string;
  suit: string;
  rank: string;
  value: number;
}

export const onRequestPost = async ({ request }: { request: Request }) => {
  try {
    const { cards } = await request.json() as { cards: Card[] };
    if (!cards || cards.length !== 13) {
      return new Response(JSON.stringify({ error: "Invalid cards input" }), { status: 400 });
    }

    // --- POKER LOGIC (Heuristic) ---
    
    const counts: Record<string, number> = {};
    cards.forEach(c => {
        const key = String(c.value); 
        counts[key] = (counts[key] || 0) + 1;
    });

    const scoredCards = cards.map(c => {
        const count = counts[String(c.value)] || 1;
        let score = c.value;
        if (count === 2) score += 100;
        if (count === 3) score += 1000;
        if (count === 4) score += 10000;
        return { ...c, score };
    });

    scoredCards.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.value - a.value; 
    });

    const back = scoredCards.slice(0, 5).map(c => { const { score, ...rest } = c; return rest; });
    const middle = scoredCards.slice(5, 10).map(c => { const { score, ...rest } = c; return rest; });
    const front = scoredCards.slice(10, 13).map(c => { const { score, ...rest } = c; return rest; });

    const result = {
        back,
        middle,
        front,
        reasoning: "基于牌型组合强度排序 (这对/三条/铁支)"
    };

    return new Response(JSON.stringify(result), { 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
