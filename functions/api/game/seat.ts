
interface D1Database {
  prepare(query: string): any;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

// NOTE: Automatic cleanup removed to support Reservation Mode. 
// Seats are held until manually left or explicitly reset by game logic.

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const carriageId = url.searchParams.get("carriageId");

  try {
    // Fetch all occupied seats
    let query = 'SELECT * FROM CarriageSeats';
    let results;

    if (carriageId) {
        query += ' WHERE carriage_id = ?';
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
    const { carriageId, seat, userId, nickname, action, nextRound } = await request.json() as any;

    // --- LEAVE ---
    if (action === 'leave') {
        if (!userId) return new Response(JSON.stringify({ error: "Missing User ID" }), { status: 400 });
        await env.DB.prepare('DELETE FROM CarriageSeats WHERE user_id = ?').bind(userId).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // --- NEXT ROUND (Jump to next carriage) ---
    if (action === 'next_round') {
        if (!userId || !carriageId || !seat) return new Response(JSON.stringify({ error: "Missing info" }), { status: 400 });
        
        await env.DB.prepare('UPDATE CarriageSeats SET game_round = ?, updated_at = (strftime("%s", "now")) WHERE carriage_id = ? AND seat = ? AND user_id = ?')
            .bind(nextRound, carriageId, seat, userId).run();
            
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // --- JOIN / SIT ---
    if (!carriageId || !seat || !userId) {
      return new Response(JSON.stringify({ error: "Missing info" }), { status: 400 });
    }

    // Check if seat is taken
    const existing = await env.DB.prepare('SELECT user_id, nickname FROM CarriageSeats WHERE carriage_id = ? AND seat = ?')
      .bind(carriageId, seat).first();

    if (existing) {
        if ((existing as any).user_id === userId) {
             // Just refreshing own seat, assume valid
             return new Response(JSON.stringify({ success: true, message: "Welcome back" }), { headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: `该位置已被 ${(existing as any).nickname} 占据` }), { status: 409 });
    }

    // Smart Round Logic:
    const others = await env.DB.prepare('SELECT game_round FROM CarriageSeats WHERE carriage_id = ?').bind(carriageId).all();
    let joinRound = 1;
    if (others.results && others.results.length > 0) {
        const rounds = others.results.map((r: any) => r.game_round || 1);
        joinRound = Math.max(...rounds);
    }

    // Remove user from other seats (ensure 1 seat per user)
    await env.DB.prepare('DELETE FROM CarriageSeats WHERE user_id = ?').bind(userId).run();

    // Take seat
    await env.DB.prepare('INSERT INTO CarriageSeats (carriage_id, seat, user_id, nickname, game_round) VALUES (?, ?, ?, ?, ?)')
      .bind(carriageId, seat, userId, nickname, joinRound).run();

    return new Response(JSON.stringify({ success: true, joinedRound: joinRound }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
