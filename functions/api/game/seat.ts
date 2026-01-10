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

  if (!carriageId) return new Response(JSON.stringify({ error: "Missing carriageId" }), { status: 400 });

  try {
    // Clean up old seats (optional: remove seats older than 24 hours if needed, currently persistent for event)
    const seats = await env.DB.prepare('SELECT * FROM CarriageSeats WHERE carriage_id = ?').bind(carriageId).all();
    
    return new Response(JSON.stringify({ seats: seats.results || [] }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { carriageId, seat, userId, nickname } = await request.json() as any;

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

    // Remove user from other seats in this carriage (one seat per person per carriage)
    await env.DB.prepare('DELETE FROM CarriageSeats WHERE carriage_id = ? AND user_id = ?').bind(carriageId, userId).run();

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
