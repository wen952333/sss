
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

// Helper to send messages
async function sendTgMessage(token: string, chatId: string, text: string, replyMarkup: any = null) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error("Send Error:", e);
  }
}

// GET Handler: 用于一键配置 Webhook
// 访问: https://你的域名/api/admin/telegram?setup=true
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const token = env.TG_BOT_TOKEN ? env.TG_BOT_TOKEN.trim() : "";
  if (!token) return new Response("Error: TG_BOT_TOKEN 未在 Cloudflare 环境变量中配置。", { status: 500 });

  const url = new URL(request.url);
  const setup = url.searchParams.get("setup");

  if (setup === "true") {
    // 自动获取当前域名并拼接 webhook 地址
    const webhookUrl = `${url.origin}/api/admin/telegram`;
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json();
      return new Response(JSON.stringify({
        status: "Webhook 配置请求已发送",
        webhook_url: webhookUrl,
        telegram_response: tgData
      }, null, 2), { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response(
    "Telegram Bot API 正常运行中。\n\n" +
    "👉 如果 Bot 无反应，请在浏览器访问此链接的 ?setup=true 版本来绑定 Webhook。\n" +
    `例如: ${url.origin}/api/admin/telegram?setup=true`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
};

// POST Handler: 处理 Telegram 发来的消息
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const token = env.TG_BOT_TOKEN ? env.TG_BOT_TOKEN.trim() : "";
    if (!token) return new Response("Missing Token", { status: 500 });

    const update: any = await request.json();
    console.log("Update received:", JSON.stringify(update)); // 方便在 CF Logs 查看

    if (!update.message && !update.edited_message) return new Response('OK');

    const message = update.message || update.edited_message;
    const chatId = String(message.chat.id);
    const text = (message.text || "").trim();
    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);
    
    // 1. 基础连通性测试 (不需要管理员权限)
    if (command === '/ping') {
        await sendTgMessage(token, chatId, "🏓 <b>Pong!</b> 机器人在线。");
        return new Response('OK');
    }

    // 2. ID 查询 (方便用户获取自己的 ID 填入环境变量)
    if (command === '/id') {
        await sendTgMessage(token, chatId, `🆔 你的 Chat ID: <code>${chatId}</code>`);
        return new Response('OK');
    }

    // 3. 管理员权限检查
    const adminId = env.ADMIN_CHAT_ID ? env.ADMIN_CHAT_ID.trim() : "";
    if (adminId && chatId !== adminId) {
         console.log(`Unauthorized access from ${chatId}`);
         await sendTgMessage(token, chatId, "⛔ <b>无权访问</b>\n你不是此机器人的管理员。");
         return new Response('OK');
    }

    // 4. 管理员命令
    if (command === '/start' || command === '/help') {
         await sendTgMessage(token, chatId, 
            "🤖 <b>管理员控制台</b>\n\n" +
            "/stats - 查看用户统计\n" +
            "/search <手机号> - 查询用户\n" +
            "/addpoints <手机号> <数量> - 加分"
         );
    } else if (command === '/stats') {
         if (env.DB) {
             const res: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
             const tables: any = await env.DB.prepare("SELECT count(*) as c FROM game_tables").first();
             await sendTgMessage(token, chatId, `📊 <b>统计数据</b>\n👥 用户总数: ${res?.c || 0}\n🃏 游戏桌数: ${tables?.c || 0}`);
         } else {
             await sendTgMessage(token, chatId, "⚠️ 数据库未连接 (env.DB is missing)");
         }
    } else if (command === '/search') {
         if (!args[0]) {
             await sendTgMessage(token, chatId, "用法: /search 手机号");
         } else {
             const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(args[0]).first();
             if (user) await sendTgMessage(token, chatId, `👤 ${user.nickname}\n💰 积分: ${user.points}\n🆔 ${user.id}`);
             else await sendTgMessage(token, chatId, "未找到用户。");
         }
    } else if (command === '/addpoints') {
         if (args.length < 2) {
             await sendTgMessage(token, chatId, "用法: /addpoints 手机号 数量");
         } else {
             await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(parseInt(args[1]), args[0]).run();
             await sendTgMessage(token, chatId, `✅ 已给 ${args[0]} 增加 ${args[1]} 分`);
         }
    } else {
        // 未知命令不回复，避免骚扰
    }

    return new Response('OK');

  } catch (e: any) {
    console.error("Telegram Error:", e);
    return new Response('Error handled', { status: 200 }); // 返回 200 防止 Telegram 重复发送失败消息
  }
};
