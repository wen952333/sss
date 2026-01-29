
interface Env { DB: any; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { action, ...data } = await request.json() as any;

    if (action === 'search') {
      const { phone } = data;
      const user: any = await env.DB.prepare("SELECT nickname, phone FROM users WHERE phone = ?").bind(phone).first();
      if (!user) return new Response(JSON.stringify({ error: "用户不存在" }), { status: 404 });
      return new Response(JSON.stringify({ success: true, user }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === 'transfer') {
      const { fromPhone, toPhone, amount } = data;
      const amountInt = parseInt(amount);
      if (amountInt <= 0) return new Response(JSON.stringify({ error: "金额必须大于0" }), { status: 400 });
      if (fromPhone === toPhone) return new Response(JSON.stringify({ error: "不能转给自己" }), { status: 400 });

      // Check balance
      const sender: any = await env.DB.prepare("SELECT points FROM users WHERE phone = ?").bind(fromPhone).first();
      if (!sender || sender.points < amountInt) {
        return new Response(JSON.stringify({ error: "余额不足" }), { status: 400 });
      }

      // Check receiver
      const receiver: any = await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(toPhone).first();
      if (!receiver) return new Response(JSON.stringify({ error: "对方账户不存在" }), { status: 404 });

      // Execute Transfer
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET points = points - ? WHERE phone = ?").bind(amountInt, fromPhone),
        env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(amountInt, toPhone)
      ]);

      const newSender = await env.DB.prepare("SELECT points FROM users WHERE phone = ?").bind(fromPhone).first();

      return new Response(JSON.stringify({ success: true, newPoints: newSender.points }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
