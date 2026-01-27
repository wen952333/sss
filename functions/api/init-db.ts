
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
  // 仅允许 GET 或 POST 请求来触发初始化
  if (context.request.method !== "GET" && context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const db = context.env.DB;

    // 1. 游戏结果表
    const createGameResultsTable = `
      CREATE TABLE IF NOT EXISTS game_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_role TEXT NOT NULL,
        winner_name TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. 用户表 (Telegram ID 作为唯一键)
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT,
        points INTEGER DEFAULT 1000, -- 新用户默认赠送1000积分
        last_check_in_date TEXT,     -- 格式 YYYY-MM-DD
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 执行 SQL
    await db.prepare(createGameResultsTable).run();
    await db.prepare(createUsersTable).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Success! Tables 'game_results' and 'users' are ready." 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message,
      hint: "Did you bind the D1 database with variable name 'DB' in Cloudflare Pages settings?"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
