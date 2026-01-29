
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

export const onRequestGet: PagesFunction = async ({ env }) => {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' not found." }), { status: 500 });
  }

  try {
    // 1. Game Tables
    const createTablesSql = `
      CREATE TABLE IF NOT EXISTS game_tables (
        id INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'waiting',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Game Players (Session based)
    const createPlayersSql = `
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT,
        table_id INTEGER,
        seat_id TEXT,
        is_ready BOOLEAN DEFAULT 0,
        hand_data TEXT,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(table_id, seat_id)
      );
    `;

    // 3. Registered Users (Persistent)
    const createUsersSql = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE,
        nickname TEXT,
        password TEXT,
        points INTEGER DEFAULT 1000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Init Data
    const initDataSql = `
      INSERT OR IGNORE INTO game_tables (id, status) VALUES (1, 'waiting');
      INSERT OR IGNORE INTO game_tables (id, status) VALUES (2, 'waiting');
    `;

    await env.DB.batch([
      env.DB.prepare(createTablesSql),
      env.DB.prepare(createPlayersSql),
      env.DB.prepare(createUsersSql),
      env.DB.prepare(initDataSql)
    ]);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Database initialized (Tables: game_tables, players, users)",
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
