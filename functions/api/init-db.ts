
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

    // 3. 房间表
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

    // 4. 支付流水表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        username TEXT,
        amount INTEGER,
        product TEXT,
        telegram_payment_charge_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 5. 系统设置表 (关键：存储 Bot 用户名)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Database tables created successfully." 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
