
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const body = await request.json() as any;
    const { carriageId, tableId, seat, hand, userId, roundId } = body;

    if (!carriageId || !userId || !hand) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const currentRound = roundId || 1;

    // 1. Save Submission (Upsert)
    const existing = await env.DB.prepare(
        'SELECT id FROM HandSubmissions WHERE carriage_id = ? AND round_id = ? AND table_id = ? AND user_id = ?'
    ).bind(carriageId, currentRound, tableId, userId).first<{id: number}>();

    const handJson = JSON.stringify(hand);

    if (existing) {
        await env.DB.prepare(
            'UPDATE HandSubmissions SET hand_json = ?, seat = ?, created_at = (strftime("%s", "now")) WHERE id = ?'
        ).bind(handJson, seat, existing.id).run();
    } else {
        await env.DB.prepare(
            'INSERT INTO HandSubmissions (carriage_id, round_id, table_id, user_id, seat, hand_json) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(carriageId, currentRound, tableId, userId, seat, handJson).run();
    }

    // 2. CHECK FOR JUMP/SYNC
    // Find the maximum round reached by *other* players in this carriage.
    // If I am at Round 7, but max is 12, I should skip to 12.
    
    const maxRes = await env.DB.prepare(
        'SELECT MAX(game_round) as max_round FROM CarriageSeats WHERE carriage_id = ? AND user_id != ?'
    ).bind(carriageId, userId).first<{max_round: number}>();

    let nextRound = currentRound; // Default: Stay same until explicit next call
    let shouldJump = false;

    if (maxRes && maxRes.max_round) {
        const leaderRound = maxRes.max_round;
        // If leader is ahead by more than 1 (meaning they are currently playing a later round)
        // We force the current player to catch up for their *next* hand.
        if (leaderRound > currentRound + 1) {
            nextRound = leaderRound;
            shouldJump = true;
            
            // Update Seat immediately so `seat.ts` knows
            await env.DB.prepare(
                'UPDATE CarriageSeats SET game_round = ?, updated_at = (strftime("%s", "now")) WHERE carriage_id = ? AND user_id = ?'
            ).bind(nextRound, carriageId, userId).run();
        }
    }

    return new Response(JSON.stringify({ 
        success: true,
        jumpToRound: shouldJump ? nextRound : null 
    }), { 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
