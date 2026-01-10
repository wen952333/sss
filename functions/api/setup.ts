// Types for Cloudflare Pages Functions
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
  all<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ success: boolean; results?: T[] }[]>;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; params: any; waitUntil: (p: Promise<any>) => void; next: () => Promise<Response>; data: any }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;

  try {
    // 1. Create Users Table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        nickname TEXT NOT NULL,
        password TEXT NOT NULL,
        points INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `).run();

    // 2. Create Transactions Table (Audit Log)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS Transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER,
        to_user_id INTEGER,
        amount INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `).run();

    // 3. Create GameDecks Table (Inventory System)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS GameDecks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cards_json TEXT NOT NULL, -- JSON array of 4 hands
        is_used BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `).run();

    // 4. Create GameResults Table (Settlement History)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS GameResults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id INTEGER,
        player_results_json TEXT, -- Stores scores per player
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `).run();

    // 5. Create CarriageSeats Table (Real-time Seating)
    // Tracks who is currently sitting in which carriage/event
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS CarriageSeats (
        carriage_id INTEGER NOT NULL,
        seat TEXT NOT NULL, -- 'North', 'South', 'East', 'West'
        user_id INTEGER NOT NULL,
        nickname TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (carriage_id, seat)
      );
    `).run();

    // 6. Create HandSubmissions Table (Real-time Gameplay)
    // Stores player hand submissions for the server to settle
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS HandSubmissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carriage_id INTEGER NOT NULL,
        table_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        seat TEXT NOT NULL,
        hand_json TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(carriage_id, table_id, user_id)
      );
    `).run();

    return new Response(JSON.stringify({ message: "Database schema updated successfully" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
