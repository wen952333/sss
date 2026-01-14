
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
  all<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
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
    const { carriageId, seat, userId, nickname, action } = await request.json() as any;

    // --- LEAVE ---
    if (action === 'leave') {
        if (!userId) return new Response(JSON.stringify({ error: "Missing User ID" }), { status: 400 });
        await env.DB.prepare('DELETE FROM CarriageSeats WHERE user_id = ?').bind(userId).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // --- DETERMINE CORRECT ROUND ---
    // Logic: 
    // 1. Check if there are ACTIVE players. If so, join their max round (catch up).
    // 2. If NO active players (empty room), check HISTORY. Join MaxHistory + 1.
    //    (This ensures if C played to 30 and left, D joins at 31, skipping the voided 21-30).
    
    const activeStats = await env.DB.prepare('SELECT MAX(game_round) as max_active FROM CarriageSeats WHERE carriage_id = ?').bind(carriageId).first<{max_active: number}>();
    const historyStats = await env.DB.prepare('SELECT MAX(round_id) as max_history FROM HandSubmissions WHERE carriage_id = ?').bind(carriageId).first<{max_history: number}>();

    const maxActive = activeStats?.max_active || 0;
    const maxHistory = historyStats?.max_history || 0;

    let targetRound = 1;

    if (maxActive > 0) {
        // Room has people. Join the leader.
        targetRound = maxActive;
    } else {
        // Room is empty. Start fresh after the last recorded history.
        targetRound = maxHistory + 1;
    }

    // --- NEXT ROUND (Update existing seat) ---
    if (action === 'next_round') {
        if (!userId || !carriageId || !seat) return new Response(JSON.stringify({ error: "Missing info" }), { status: 400 });
        
        // If I am simply moving next, usually it's MyRound + 1.
        // But if I fell behind and everyone else is ahead, or if I am re-syncing?
        // To support "Skipping Void Rounds", we rely on the logic above. 
        // If the room is empty, I jump to History+1.
        
        // However, specifically for 'next_round' called by client, the client usually suggests `nextRound` value.
        // But we should enforce the "Void Skip" rule here.
        
        // If I am at 20, and maxHistory is 30 (voided), and maxActive is 0. 
        // targetRound becomes 31. I should jump to 31.
        
        await env.DB.prepare('UPDATE CarriageSeats SET game_round = ?, updated_at = (strftime("%s", "now")) WHERE carriage_id = ? AND seat = ? AND user_id = ?')
            .bind(targetRound, carriageId, seat, userId).run();
            
        return new Response(JSON.stringify({ success: true, nextRound: targetRound }), { headers: { "Content-Type": "application/json" } });
    }

    // --- JOIN / SIT ---
    if (!carriageId || !seat || !userId) {
      return new Response(JSON.stringify({ error: "Missing info" }), { status: 400 });
    }

    const existing = await env.DB.prepare('SELECT user_id, nickname FROM CarriageSeats WHERE carriage_id = ? AND seat = ?')
      .bind(carriageId, seat).first();

    if (existing) {
        if ((existing as any).user_id === userId) {
             return new Response(JSON.stringify({ success: true, message: "Welcome back", joinedRound: targetRound }), { headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: `该位置已被 ${(existing as any).nickname} 占据` }), { status: 409 });
    }

    // Remove user from other seats
    await env.DB.prepare('DELETE FROM CarriageSeats WHERE user_id = ?').bind(userId).run();

    // Take seat at Target Round
    await env.DB.prepare('INSERT INTO CarriageSeats (carriage_id, seat, user_id, nickname, game_round) VALUES (?, ?, ?, ?, ?)')
      .bind(carriageId, seat, userId, nickname, targetRound).run();

    return new Response(JSON.stringify({ success: true, joinedRound: targetRound }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
