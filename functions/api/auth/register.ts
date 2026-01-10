interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
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
    const { phone, nickname, password } = await context.request.json() as any;

    if (!phone || !nickname || !password) {
      return new Response(JSON.stringify({ error: "缺少必要信息" }), { status: 400 });
    }

    if (password.length < 6) {
       return new Response(JSON.stringify({ error: "密码至少需要6位" }), { status: 400 });
    }

    const existing = await context.env.DB.prepare('SELECT id FROM Users WHERE phone = ?').bind(phone).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "该手机号已注册" }), { status: 400 });
    }

    const result = await context.env.DB.prepare(
      'INSERT INTO Users (phone, nickname, password, points) VALUES (?, ?, ?, 0)'
    ).bind(phone, nickname, password).run();

    if (result.success) {
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } else {
       throw new Error("Insert failed");
    }

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "注册失败" }), { status: 500 });
  }
};