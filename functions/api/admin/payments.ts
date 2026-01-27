
type D1Database = {
  prepare: (query: string) => { 
    bind: (...args: any[]) => any; 
    run: () => Promise<any>; 
    all: <T = any>() => Promise<{ results: T[] }>;
  };
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not bound" }), { status: 500 });
  }

  try {
    // 简单的鉴权：实际项目中应验证 Request Header 中的 Admin Token 或 Session
    // 这里为了演示，直接返回最近的 50 条记录
    const { results } = await env.DB.prepare(`
      SELECT * FROM payments ORDER BY created_at DESC LIMIT 50
    `).all();

    return new Response(JSON.stringify({ success: true, payments: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
