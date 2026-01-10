import { generateDeck } from '../../utils/pokerLogic';

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ success: boolean; results?: T[] }[]>;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  try {
    const countResult = await db.prepare('SELECT COUNT(*) as count FROM GameDecks WHERE is_used = 0').first<{ count: number }>();
    const count = countResult?.count || 0;

    if (count < 100) {
        const needed = 200 - count;
        const statements = [];
        for (let i = 0; i < needed; i++) {
            const deck = generateDeck();
            const hands = {
                'North': deck.slice(0, 13),
                'East': deck.slice(13, 26),
                'South': deck.slice(26, 39),
                'West': deck.slice(39, 52),
            };
            statements.push(
                db.prepare('INSERT INTO GameDecks (cards_json, is_used) VALUES (?, 0)')
                  .bind(JSON.stringify(hands))
            );
        }
        if (statements.length > 0) {
            await db.batch(statements);
        }
    }

    const deck = await db.prepare('SELECT id, cards_json FROM GameDecks WHERE is_used = 0 LIMIT 1').first<{ id: number, cards_json: string }>();

    if (!deck) {
        return new Response(JSON.stringify({ error: "System initializing, please retry" }), { status: 503 });
    }
    
    await db.prepare('UPDATE GameDecks SET is_used = 1 WHERE id = ?').bind(deck.id).run();

    return new Response(JSON.stringify({ 
        success: true, 
        deckId: deck.id, 
        hands: JSON.parse(deck.cards_json) 
    }), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};