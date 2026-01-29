
interface Env {
  DB: any;
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  let dbStatus = "unknown";
  try {
      if (env.DB) {
        const result: any = await env.DB.prepare("SELECT count(*) as count FROM game_tables").first();
        dbStatus = `connected (Tables: ${result.count})`;
      } else {
        dbStatus = "disconnected (Binding missing)";
      }
  } catch (e: any) {
      dbStatus = `error: ${e.message}`;
  }

  return new Response(JSON.stringify({
    service: "Shisanshui Game API",
    status: "online",
    database: dbStatus,
    timestamp: new Date().toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
};
