
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

// Use this endpoint to set webhook: https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_DOMAIN>/api/admin/telegram
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const update = await request.json() as any;
    if (!update.message || !update.message.text) return new Response('OK');

    const chatId = String(update.message.chat.id);
    const text = update.message.text.trim();
    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);

    // 1. Security Check
    if (env.ADMIN_CHAT_ID && chatId !== env.ADMIN_CHAT_ID) {
      await sendTgMessage(env, chatId, "⛔ <b>Access Denied</b>\nYou are not the administrator.");
      return new Response('OK');
    }

    let responseText = "";
    let replyMarkup: any = null;

    // Main Menu Keyboard
    const mainMenuKeyboard = {
      keyboard: [
        [{ text: "📊 系统概览" }, { text: "👥 用户榜单 (Top 10)" }],
        [{ text: "🛠 常用指令" }, { text: "❓ 帮助" }]
      ],
      resize_keyboard: true,
      persistent: true
    };

    // 2. Logic Handler
    switch (text) {
      case '/start':
      case '❓ 帮助':
        responseText = `🤖 <b>十三水管理员控制台</b>\n\n欢迎回来，管理员！\n请使用下方键盘进行操作，或直接输入指令。`;
        replyMarkup = mainMenuKeyboard;
        break;

      case '📊 系统概览':
        const userCount: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
        const tableCount: any = await env.DB.prepare("SELECT count(*) as c FROM game_tables").first();
        const activePlayers: any = await env.DB.prepare("SELECT count(*) as c FROM players").first();
        
        responseText = `<b>📊 系统实时状态</b>\n\n` +
                       `👥 注册用户: <b>${userCount?.c || 0}</b>\n` +
                       `🃏 游戏桌数: <b>${tableCount?.c || 0}</b>\n` +
                       `🎮 在线玩家: <b>${activePlayers?.c || 0}</b>\n` +
                       `🕒 服务器时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
        replyMarkup = mainMenuKeyboard;
        break;

      case '👥 用户榜单 (Top 10)':
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
        replyMarkup = mainMenuKeyboard;
        break;

      case '🛠 常用指令':
        responseText = "<b>🛠 快捷指令复制</b>\n点击下方命令即可复制到输入框，修改参数后发送：\n\n" +
                       "🔍 <b>查询用户:</b>\n<code>/search 13800000000</code>\n\n" +
                       "💰 <b>增减积分:</b>\n<code>/points 13800000000 1000</code>\n(使用负数扣分)\n\n" +
                       "🗑 <b>删除用户:</b>\n<code>/delete 13800000000</code>";
        replyMarkup = mainMenuKeyboard;
        break;

      default:
        // Command Handlers
        if (command === '/search') {
          if (!args[0]) responseText = "❌ 请输入手机号。例如: <code>/search 13800000000</code>";
          else {
            const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(args[0]).first();
            if (user) {
              responseText = `👤 <b>用户信息</b>\n\n` +
                             `🆔 ID: <code>${user.id}</code>\n` +
                             `👤 昵称: <b>${user.nickname}</b>\n` +
                             `📱 手机: <code>${user.phone}</code>\n` +
                             `💰 积分: <b>${user.points}</b>\n` +
                             `📅 注册: ${user.created_at}`;
            } else {
              responseText = "❌ 未找到该用户";
            }
          }
        } 
        else if (command === '/points') {
          if (args.length < 2) responseText = "❌ 格式错误。\n用法: <code>/points <手机号> <数量></code>";
          else {
            const phone = args[0];
            const amount = parseInt(args[1]);
            const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
            if (!user) {
              responseText = "❌ 用户不存在";
            } else {
              await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(amount, phone).run();
              const newUser: any = await env.DB.prepare("SELECT points FROM users WHERE phone = ?").bind(phone).first();
              responseText = `✅ <b>操作成功</b>\n\n用户: ${user.nickname}\n变动: ${amount > 0 ? '+' + amount : amount}\n当前积分: <b>${newUser.points}</b>`;
            }
          }
        } 
        else if (command === '/delete') {
           if (!args[0]) responseText = "❌ 请输入手机号。";
           else {
             await env.DB.prepare("DELETE FROM users WHERE phone = ?").bind(args[0]).run();
             responseText = `🗑️ 用户 <code>${args[0]}</code> 已从数据库删除。`;
           }
        }
        else {
          responseText = "❓ 未知命令，请使用底部菜单。";
          replyMarkup = mainMenuKeyboard;
        }
        break;
    }

    await sendTgMessage(env, chatId, responseText, replyMarkup);
    return new Response('OK');

  } catch (e: any) {
    console.error(e);
    return new Response(e.message, { status: 500 });
  }
};

async function sendTgMessage(env: Env, chatId: string, text: string, replyMarkup: any = null) {
  if (!env.TG_BOT_TOKEN) return;
  
  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
