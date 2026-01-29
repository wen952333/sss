
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const update = await request.json() as any;
    if (!update.message || !update.message.text) return new Response('OK');

    const chatId = update.message.chat.id;
    const text = update.message.text;
    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);

    let responseText = "";

    if (command === '/start') {
      responseText = "🤖 十三水管理机器人\n\n命令列表:\n/list - 查看前10名用户\n/search <手机号> - 查找用户\n/points <手机号> <数量> - 增减积分(正数加，负数减)\n/delete <手机号> - 删除用户";
    } 
    else if (command === '/list') {
      const { results } = await env.DB.prepare("SELECT phone, nickname, points FROM users LIMIT 10").all();
      if (!results || results.length === 0) responseText = "暂无用户";
      else responseText = "📋 用户列表 (Top 10):\n" + results.map((u:any) => `- ${u.nickname} (${u.phone}): 💰${u.points}`).join('\n');
    } 
    else if (command === '/search') {
      if (!args[0]) responseText = "❌ 请输入手机号";
      else {
        const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(args[0]).first();
        if (user) responseText = `👤 用户信息:\n昵称: ${user.nickname}\n手机: ${user.phone}\n积分: ${user.points}\n注册时间: ${user.created_at}`;
        else responseText = "❌ 未找到该用户";
      }
    } 
    else if (command === '/points') {
      if (args.length < 2) responseText = "❌ 格式: /points <手机号> <数量>";
      else {
        const phone = args[0];
        const amount = parseInt(args[1]);
        const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
        if (!user) responseText = "❌ 用户不存在";
        else {
          await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(amount, phone).run();
          responseText = `✅ 成功! ${user.nickname} 的积分变更 ${amount}。现有: ${user.points + amount}`;
        }
      }
    } 
    else if (command === '/delete') {
       if (!args[0]) responseText = "❌ 请输入手机号";
       else {
         await env.DB.prepare("DELETE FROM users WHERE phone = ?").bind(args[0]).run();
         responseText = `🗑️ 用户 ${args[0]} 已删除`;
       }
    }
    else {
      responseText = "❓ 未知命令";
    }

    await sendTgMessage(env, chatId, responseText);
    return new Response('OK');

  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};

async function sendTgMessage(env: Env, chatId: string, text: string) {
  if (!env.TG_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
