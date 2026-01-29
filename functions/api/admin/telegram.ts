
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    // 1. Safe Token Access (Trim whitespace to prevent config errors)
    const token = env.TG_BOT_TOKEN ? env.TG_BOT_TOKEN.trim() : "";
    const adminId = env.ADMIN_CHAT_ID ? env.ADMIN_CHAT_ID.trim() : "";

    if (!token) {
      console.error("❌ CRITICAL: TG_BOT_TOKEN is missing or empty!");
      return new Response("Missing TG_BOT_TOKEN", { status: 500 });
    }

    const update = await request.json() as any;
    console.log("📩 Update:", JSON.stringify(update));

    // Handle 'edited_message' or 'message' to be more robust
    const message = update.message || update.edited_message;
    if (!message || !message.text) return new Response('OK');

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);

    // 2. Public Debug Command (Helps you find your ID)
    // Send /id to the bot to verify it is working and get your ID
    if (command === '/id') {
      await sendTgMessage(token, chatId, `🆔 <b>Your Chat ID:</b> <code>${chatId}</code>`);
      return new Response('OK');
    }

    // 3. Security Check
    if (adminId && chatId !== adminId) {
      console.warn(`⛔ Access Denied: User ${chatId} tried to use bot. Expected: ${adminId}`);
      await sendTgMessage(token, chatId, "⛔ <b>无权访问</b>\n你不是管理员。\n发送 <code>/id</code> 获取你的 ID 并添加到环境变量 ADMIN_CHAT_ID 中。");
      return new Response('OK');
    }

    let responseText = "";
    let replyMarkup: any = null;

    const mainMenuKeyboard = {
      keyboard: [
        [{ text: "📊 系统概览" }, { text: "👥 用户榜单 (Top 10)" }],
        [{ text: "🛠 常用指令" }, { text: "❓ 帮助" }]
      ],
      resize_keyboard: true,
      persistent: true
    };

    switch (text) {
      case '/start':
      case '❓ 帮助':
        responseText = `🤖 <b>管理员控制台</b>\n\n当前管理员ID: <code>${chatId}</code>\n状态: ✅ 已连接\n\n请选择操作：`;
        replyMarkup = mainMenuKeyboard;
        break;

      case '📊 系统概览':
        if (!env.DB) { responseText = "❌ 数据库未连接 (DB Binding Missing)"; break; }
        try {
            const userCount: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
            const tableCount: any = await env.DB.prepare("SELECT count(*) as c FROM game_tables").first();
            const activePlayers: any = await env.DB.prepare("SELECT count(*) as c FROM players").first();
            
            responseText = `<b>📊 系统实时状态</b>\n\n` +
                           `👥 注册用户: <b>${userCount?.c || 0}</b>\n` +
                           `🃏 游戏桌数: <b>${tableCount?.c || 0}</b>\n` +
                           `🎮 在线玩家: <b>${activePlayers?.c || 0}</b>\n` +
                           `🕒 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
        } catch(err: any) {
            responseText = `❌ 数据库查询失败: ${err.message}`;
        }
        replyMarkup = mainMenuKeyboard;
        break;

      case '👥 用户榜单 (Top 10)':
        if (!env.DB) { responseText = "❌ 数据库未连接"; break; }
        try {
            const { results } = await env.DB.prepare("SELECT phone, nickname, points FROM users ORDER BY points DESC LIMIT 10").all();
            if (!results || results.length === 0) {
              responseText = "暂无用户数据。";
            } else {
              responseText = "🏆 <b>积分排行榜 (Top 10)</b>\n\n";
              results.forEach((u: any, index: number) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
                responseText += `${medal} <b>${u.nickname}</b>\n   📱 <code>${u.phone}</code>\n   💰 ${u.points}\n\n`;
              });
            }
        } catch(err: any) {
             responseText = `❌ 查询失败: ${err.message}`;
        }
        replyMarkup = mainMenuKeyboard;
        break;

      case '🛠 常用指令':
        responseText = "<b>🛠 指令面板</b>\n\n" +
                       "🔍 <b>查询:</b> `/search <手机号>`\n" +
                       "💰 <b>积分:</b> `/points <手机号> <数量>`\n" +
                       "🗑 <b>删除:</b> `/delete <手机号>`\n\n" +
                       "点击上方命令复制。";
        replyMarkup = mainMenuKeyboard;
        break;

      default:
        // Command Logic
        if (!env.DB) { responseText = "❌ 数据库未连接"; break; }
        
        if (command === '/search') {
          if (!args[0]) responseText = "❌ 用法: `/search 13800000000`";
          else {
            const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(args[0]).first();
            responseText = user 
                ? `👤 <b>${user.nickname}</b>\n📱 ${user.phone}\n💰 ${user.points}` 
                : "❌ 用户不存在";
          }
        } 
        else if (command === '/points') {
           if (args.length < 2) responseText = "❌ 用法: `/points 13800000000 100`";
           else {
             const phone = args[0];
             const amount = parseInt(args[1]);
             await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(amount, phone).run();
             const u: any = await env.DB.prepare("SELECT points, nickname FROM users WHERE phone = ?").bind(phone).first();
             responseText = u ? `✅ <b>${u.nickname}</b> 最新积分: ${u.points}` : "❌ 用户不存在";
           }
        }
        else if (command === '/delete') {
            if (!args[0]) responseText = "❌ 用法: `/delete 13800000000`";
            else {
                await env.DB.prepare("DELETE FROM users WHERE phone = ?").bind(args[0]).run();
                responseText = "🗑️ 用户已删除";
            }
        }
        else {
          responseText = "❓ 未知指令，请使用菜单。";
          replyMarkup = mainMenuKeyboard;
        }
        break;
    }

    await sendTgMessage(token, chatId, responseText, replyMarkup);
    return new Response('OK');

  } catch (e: any) {
    console.error("❌ Bot Error:", e);
    return new Response(e.message, { status: 500 });
  }
};

async function sendTgMessage(token: string, chatId: string, text: string, replyMarkup: any = null) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const res: any = await resp.json();
    if (!res.ok) console.error("Telegram API Error:", res);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
