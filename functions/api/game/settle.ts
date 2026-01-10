import { calculateTableScores, PlayerHand } from '../../utils/pokerLogic';

type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const { submissions } = await context.request.json() as { 
        submissions: { playerId: string, hand: PlayerHand, name: string }[] 
    };

    if (!submissions || submissions.length < 2) {
        return new Response(JSON.stringify({ error: "Need at least 2 players" }), { status: 400 });
    }

    const scores = calculateTableScores(submissions);

    return new Response(JSON.stringify({ 
        success: true, 
        scores 
    }), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};