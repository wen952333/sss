
interface D1Database {
  prepare(query: string): any;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const body = await request.json() as any;
    // Support both direct format or nested in 'submission' key
    const { carriageId, tableId, seat, hand, userId, roundId } = body;

    if (!carriageId || !userId || !hand) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const currentRound = roundId || 1;

    // Check if submission already exists to prevent duplicates (upsert logic)
    const existing = await env.DB.prepare(
        'SELECT id FROM HandSubmissions WHERE carriage_id = ? AND table_id = ? AND user_id = ?'
    ).bind(carriageId, tableId, userId).first();

    const handJson = JSON.stringify(hand);

    if (existing) {
        await env.DB.prepare(
            'UPDATE HandSubmissions SET hand_json = ?, seat = ?, created_at = (strftime("%s", "now")) WHERE id = ?'
        ).bind(handJson, seat, existing.id).run();
    } else {
        await env.DB.prepare(
            'INSERT INTO HandSubmissions (carriage_id, table_id, user_id, seat, hand_json) VALUES (?, ?, ?, ?, ?)'
        ).bind(carriageId, tableId, userId, seat, handJson).run();
    }

    return new Response(JSON.stringify({ success: true }), { 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
