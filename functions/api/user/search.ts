interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { query } = await context.request.json() as any;

    if (!query) return new Response(JSON.stringify({ error: "Empty query" }), { status: 400 });

    const user = await context.env.DB.prepare(
      'SELECT id, phone, nickname FROM Users WHERE phone = ?'
    ).bind(query).first();

    if (!user) {
      return new Response(JSON.stringify({ found: false }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ found: true, user }), { 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};