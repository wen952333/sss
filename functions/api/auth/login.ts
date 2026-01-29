
interface Env { DB: any; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { phone, password } = await request.json() as any;
    
    const user: any = await env.DB.prepare("SELECT id, phone, nickname, points FROM users WHERE phone = ? AND password = ?")
      .bind(phone, password)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "账号或密码错误" }), { status: 401 });
    }

    return new Response(JSON.stringify({ success: true, user }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
