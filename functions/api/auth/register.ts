
interface Env { DB: any; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { phone, nickname, password } = await request.json() as any;

    if (!phone || !nickname || !password) return new Response(JSON.stringify({ error: "缺少必要信息" }), { status: 400 });
    if (password.length < 6) return new Response(JSON.stringify({ error: "密码至少6位" }), { status: 400 });

    const id = crypto.randomUUID();
    const stmt = env.DB.prepare("INSERT INTO users (id, phone, nickname, password) VALUES (?, ?, ?, ?)");
    
    await stmt.bind(id, phone, nickname, password).run();

    return new Response(JSON.stringify({ success: true, user: { id, phone, nickname, points: 1000 } }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
        return new Response(JSON.stringify({ error: "该手机号已注册" }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
