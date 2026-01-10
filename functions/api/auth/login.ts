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
    const { phone, password } = await context.request.json() as any;

    const user = await context.env.DB.prepare(
      'SELECT id, phone, nickname, points FROM Users WHERE phone = ? AND password = ?'
    ).bind(phone, password).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "手机号或密码错误" }), { status: 401 });
    }

    return new Response(JSON.stringify({ user }), { 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "登录服务异常" }), { status: 500 });
  }
};