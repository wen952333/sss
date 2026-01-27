
// Define types locally to ensure compatibility without extra config
type D1Database = {
  prepare: (query: string) => { run: () => Promise<any> };
};

type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "GET" && context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const db = context.env.DB;

    // 1. 游戏结果表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS game_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_role TEXT NOT NULL,
        winner_name TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 2. 用户表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT,
        points INTEGER DEFAULT 1000,
        last_check_in_date TEXT,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 3. 房间表 (核心：存储多人游戏状态)
    // room_id: 房间号
    // players_json: 存储 [{id, name, isReady...}]
    // game_state_json: 存储完整的 GameState (牌堆、出牌记录等)
    // status: 'waiting', 'playing', 'finished'
    // updated_at: 用于轮询判断版本
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        host_id INTEGER,
        players_json TEXT, 
        game_state_json TEXT,
        status TEXT DEFAULT 'waiting',
        updated_at INTEGER
      );
    `).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Database tables (including 'rooms') created successfully." 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message,
      hint: "Ensure D1 Database 'DB' is bound in Cloudflare Pages settings."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
