
interface Env {
  DB: any;
}

type PagesFunction = (context: {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: any;
  data: any;
}) => Response | Promise<Response>;

interface JoinRequest {
  tableId: number;
  seatId: string;
  playerName?: string;
  playerId?: string; // Optional: if reconnecting
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 });
  }

  try {
    const body = await request.json() as JoinRequest;

    if (!body.tableId || !body.seatId) {
      return new Response(JSON.stringify({ error: "Missing tableId or seatId" }), { status: 400 });
    }

    const playerId = body.playerId || crypto.randomUUID();
    const playerName = body.playerName || `Player ${playerId.substring(0, 4)}`;

    // 1. Check if the table exists
    const table: any = await env.DB.prepare("SELECT * FROM game_tables WHERE id = ?")
      .bind(body.tableId)
      .first();

    if (!table) {
      return new Response(JSON.stringify({ error: "Table does not exist" }), { status: 404 });
    }

    if (table.status !== 'waiting') {
      return new Response(JSON.stringify({ error: "Game already in progress" }), { status: 403 });
    }

    // 2. Check if seat is taken
    const existingSeat: any = await env.DB.prepare("SELECT * FROM players WHERE table_id = ? AND seat_id = ?")
      .bind(body.tableId, body.seatId)
      .first();

    if (existingSeat) {
      // Allow reconnect if playerId matches
      if (existingSeat.id === playerId) {
        return new Response(JSON.stringify({
          success: true,
          message: "Reconnected to seat",
          playerToken: playerId,
          tableId: body.tableId,
          seatId: body.seatId
        }));
      }
      return new Response(JSON.stringify({ error: "Seat is already taken" }), { status: 409 });
    }

    // 3. Occupy the seat
    await env.DB.prepare(`
      INSERT INTO players (id, name, table_id, seat_id, is_ready)
      VALUES (?, ?, ?, ?, 0)
    `).bind(playerId, playerName, body.tableId, body.seatId).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully joined Table ${body.tableId} at ${body.seatId}`,
      playerToken: playerId,
      playerName: playerName
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error(e);
    // Handle Unique Constraint Violation (Race condition on seat)
    if (e.message && e.message.includes('UNIQUE constraint failed')) {
         return new Response(JSON.stringify({ error: "Seat was just taken by another player" }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: "Invalid Request or Server Error" }), { status: 400 });
  }
};
