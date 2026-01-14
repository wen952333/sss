
import { calculateTableScores, PlayerHand, autoArrangeHand, generateDeck, Card } from '../../utils/pokerLogic';

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
  const carriageIdStr = url.searchParams.get("carriageId");
  
  if (!carriageIdStr) {
      return new Response(JSON.stringify({ error: "carriageId required" }), { status: 400 });
  }

  const carriageId = parseInt(carriageIdStr);
  const AFK_THRESHOLD_SECONDS = 300; // 5 Minutes

  try {
    // 1. Get all currently seated players
    const seatsRes = await env.DB.prepare('SELECT user_id, seat, nickname, game_round FROM CarriageSeats WHERE carriage_id = ?').bind(carriageId).all<any>();
    const seats = seatsRes.results || [];
    
    // 2. Get existing submissions
    let query = `
        SELECT * FROM HandSubmissions WHERE carriage_id = ? ORDER BY created_at DESC
    `;
    const results = await env.DB.prepare(query).bind(carriageId).all<any>();
    const submissions = results.results || [];

    const getLastActiveTime = (userId: number): number => {
        const userSubs = submissions.filter((s:any) => s.user_id === userId);
        if (userSubs.length === 0) return 0; 
        userSubs.sort((a:any, b:any) => b.created_at - a.created_at);
        return userSubs[0].created_at; 
    };

    const currentTime = Math.floor(Date.now() / 1000);

    const grouped: any = {};
    submissions.forEach(sub => {
        const rId = sub.round_id || 1;
        const tId = sub.table_id;
        if (!grouped[rId]) grouped[rId] = {};
        if (!grouped[rId][tId]) grouped[rId][tId] = [];
        
        grouped[rId][tId].push({
            ...sub,
            hand: JSON.parse(sub.hand_json)
        });
    });

    // --- LOGIC START ---
    const roundsToCheck = Object.keys(grouped);
    
    for (const rId of roundsToCheck) {
        const roundId = parseInt(rId);
        const tablesInRound = Object.keys(grouped[rId]);
        
        for (const tIdStr of tablesInRound) {
            const tableId = parseInt(tIdStr);
            const subsInTable = grouped[rId][tIdStr];
            const submittedUserIds = new Set(subsInTable.map((s:any) => s.user_id));
            
            // Check missing seated players
            for (const seat of seats) {
                // If this seated player hasn't submitted for this specific active table
                if (!submittedUserIds.has(seat.user_id)) {
                    
                    const lastActive = getLastActiveTime(seat.user_id);
                    const timeDiff = currentTime - lastActive;
                    
                    // CASE 1: ACTIVE (Thinking) -> Skip (Partial Settlement will happen below)
                    // If they played recently (within 5 mins), assume they are just slow.
                    // We DO NOT auto-play. We leave them out of this round's calc.
                    if (lastActive > 0 && timeDiff < AFK_THRESHOLD_SECONDS) {
                        continue; 
                    }

                    // CASE 2: TIMEOUT / AFK -> Auto-Play AND KICK
                    // Player hasn't moved in 5 mins.
                    
                    const fullDeck = generateDeck(); // Ideally specific to table seed
                    const myCards = fullDeck.slice(0, 13); 
                    const autoHand = autoArrangeHand(myCards);
                    
                    // 2a. Insert Auto Submission
                    await env.DB.prepare(
                        'INSERT INTO HandSubmissions (carriage_id, round_id, table_id, user_id, seat, hand_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
                    ).bind(carriageId, roundId, tableId, seat.user_id, seat.seat, JSON.stringify(autoHand), currentTime).run();
                    
                    // 2b. KICK PLAYER (Delete from Seats)
                    // This ensures when they come back, they see Lobby.
                    await env.DB.prepare(
                        'DELETE FROM CarriageSeats WHERE carriage_id = ? AND user_id = ?'
                    ).bind(carriageId, seat.user_id).run();

                    // 2c. Add to local group so they are included in THIS settlement
                    grouped[rId][tIdStr].push({
                        user_id: seat.user_id,
                        nickname: seat.nickname + " (超时托管)",
                        seat: seat.seat,
                        hand: autoHand,
                        is_auto: true
                    });
                }
            }
        }
    }

    // --- REPORT GENERATION ---
    const reportDetails: any[] = [];

    Object.keys(grouped).forEach(rId => {
        Object.keys(grouped[rId]).forEach(tId => {
            const finalSubs = grouped[rId][tId];
            
            // Map to format for calculation
            const calcPayload = finalSubs.map((s:any) => ({
                playerId: 'u_' + s.user_id,
                name: s.nickname || `User ${s.user_id}`,
                hand: s.hand
            }));

            // Only calculate if >= 2 players
            if (calcPayload.length >= 2) {
                // Now supports dynamic player counts (2, 3, or 4)
                const scores = calculateTableScores(calcPayload); 
                
                reportDetails.push({
                    roundId: parseInt(rId),
                    tableId: parseInt(tId),
                    details: finalSubs.map((s:any) => ({
                        name: s.nickname,
                        score: scores['u_' + s.user_id] || 0,
                        hand: s.hand,
                        seat: s.seat
                    })),
                    voided: false
                });
            } else {
                // Void
                reportDetails.push({
                    roundId: parseInt(rId),
                    tableId: parseInt(tId),
                    details: finalSubs.map((s:any) => ({ name: s.nickname, score: 0, hand: s.hand, seat: s.seat })),
                    voided: true
                });
            }
        });
    });

    return new Response(JSON.stringify({ 
        success: true, 
        details: reportDetails 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
