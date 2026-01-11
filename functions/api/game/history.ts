
import { calculateTableScores, PlayerHand } from '../../utils/pokerLogic';

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
  const forceShowStr = url.searchParams.get("force"); // Admin/Timeout override
  
  if (!carriageIdStr) {
      return new Response(JSON.stringify({ error: "carriageId required" }), { status: 400 });
  }

  const carriageId = parseInt(carriageIdStr);

  try {
    // 1. Get current seated player count for this carriage
    const seatsRes = await env.DB.prepare('SELECT count(*) as count FROM CarriageSeats WHERE carriage_id = ?').bind(carriageId).first<{count: number}>();
    const seatedCount = seatsRes?.count || 0;

    // 2. Get submissions
    let query = `
        SELECT 
            hs.carriage_id,
            hs.table_id,
            hs.seat,
            hs.hand_json,
            hs.user_id,
            u.nickname
        FROM HandSubmissions hs
        LEFT JOIN Users u ON hs.user_id = u.id
        WHERE hs.carriage_id = ?
        ORDER BY hs.created_at DESC
    `;
    
    const results = await env.DB.prepare(query).bind(carriageId).all();

    if (!results.success) {
        return new Response(JSON.stringify({ error: "DB Error" }), { status: 500 });
    }

    const rows = results.results as any[];
    
    // Group by Carriage -> Table
    const grouped: any = {};
    
    rows.forEach(row => {
        const cId = row.carriage_id;
        const tId = row.table_id;
        if (!grouped[cId]) grouped[cId] = {};
        if (!grouped[cId][tId]) grouped[cId][tId] = [];
        
        grouped[cId][tId].push({
            playerId: 'u_' + row.user_id,
            name: row.nickname || `User ${row.user_id}`,
            seat: row.seat,
            hand: JSON.parse(row.hand_json) as PlayerHand,
            timestamp: row.created_at 
        });
    });

    const reportDetails: any[] = [];

    Object.keys(grouped).forEach(cId => {
        Object.keys(grouped[cId]).forEach(tId => {
            const submissions = grouped[cId][tId];
            
            // LOGIC:
            // If submissions.length < seatedCount, it is PENDING.
            // If seatedCount has dropped (players left/kicked), we use the current seatedCount.
            // So if 4 played, 1 left, seatedCount=3. If submissions=3, it's Complete.
            // If system clears ALL (seatedCount=0), it's Complete.
            
            let isPending = false;
            if (seatedCount > 0 && submissions.length < seatedCount) {
                isPending = true;
            }
            
            // Override if force is requested
            if (forceShowStr === 'true') isPending = false;

            let scores: Record<string, number> = {};
            let details = [];

            if (isPending) {
                // MASK DATA: Return who submitted, but NOT their hands or scores
                submissions.forEach((s: any) => scores[s.playerId] = 0);
                details = submissions.map((s: any) => ({
                    playerId: s.playerId,
                    name: s.name,
                    seat: s.seat,
                    hand: null, // HIDDEN
                    score: 0,
                    specialType: null
                }));
            } else {
                // Calculate real scores
                const isVoid = submissions.length < 2; // Still void if < 2 players total even if "complete"
                if (!isVoid) {
                    scores = calculateTableScores(submissions);
                } else {
                    submissions.forEach((s: any) => scores[s.playerId] = 0);
                }

                details = submissions.map((s: any) => ({
                    playerId: s.playerId,
                    name: s.name,
                    seat: s.seat,
                    hand: s.hand,
                    score: scores[s.playerId] || 0,
                }));
            }

            reportDetails.push({
                tableId: parseInt(tId),
                carriageId: parseInt(cId),
                playersInvolved: submissions.map((s:any) => s.name),
                scores,
                details,
                status: isPending ? 'pending' : 'complete',
                pendingCount: Math.max(0, seatedCount - submissions.length),
                voided: !isPending && submissions.length < 2
            });
        });
    });

    // Sort by table ID
    reportDetails.sort((a,b) => a.tableId - b.tableId);

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
