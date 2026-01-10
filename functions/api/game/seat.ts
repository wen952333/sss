interface D1Database {
  prepare(query: string): any;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const carriageId = url.searchParams.get("carriageId");

  try {
    // If carriageId is provided, get specific, else get all valid seats
    // We filter out stale seats (e.g., older than 2 hours) to avoid ghost players
    let query = 'SELECT * FROM CarriageSeats WHERE updated_at > (strftime("%s", "now") - 7200)';
    let results;

    if (carriageId) {
        query += ' AND carriage_id = ?';
        results = await env.DB.prepare(query).bind(carriageId).all();
    } else {
        results = await env.DB.prepare(query).all();
    }
    
    return new Response(JSON.stringify({ seats: results.results || [] }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { carriageId, seat, userId, nickname, action } = await request.json() as any;

    if (action === 'leave') {
        if (!userId) return new Response(JSON.stringify({ error: "Missing User ID" }), { status: 400 });
        await env.DB.prepare('DELETE FROM CarriageSeats WHERE user_id = ?').bind(userId).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Default action: Join/Sit
    if (!carriageId || !seat || !userId) {
      return new Response(JSON.stringify({ error: "Missing info" }), { status: 400 });
    }

    // Check if seat is taken
    const existing = await env.DB.prepare('SELECT user_id, nickname FROM CarriageSeats WHERE carriage_id = ? AND seat = ?')
      .bind(carriageId, seat).first();

    if (existing) {
        // If it's the same user, that's fine, update timestamp
        if ((existing as any).user_id === userId) {
             await env.DB.prepare('UPDATE CarriageSeats SET updated_at = (strftime("%s", "now")) WHERE carriage_id = ? AND seat = ?').bind(carriageId, seat).run();
             return new Response(JSON.stringify({ success: true, message: "Welcome back" }), { headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: `该位置已被 ${(existing as any).nickname} 占据` }), { status: 409 });
    }

    // Remove user from other seats in ANY carriage (one seat per person globally to prevent multi-tabbing)
    await env.DB.prepare('DELETE FROM CarriageSeats WHERE user_id = ?').bind(userId).run();

    // Take seat
    await env.DB.prepare('INSERT INTO CarriageSeats (carriage_id, seat, user_id, nickname) VALUES (?, ?, ?, ?)')
      .bind(carriageId, seat, userId, nickname).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
