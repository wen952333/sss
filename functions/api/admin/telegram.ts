
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

// Keyboard Definition
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "📊 统计数据" }, { text: "🔍 查询用户" }],
    [{ text: "💰 增加积分" }, { text: "🆔 我的ID" }],
    [{ text: "🛠 调试信息" }, { text: "❓ 帮助" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

async function sendTgMessage(token: string, chatId: string, text: string, replyMarkup: any = null) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;

    let response = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
    });

    if (response.status === 400) {
      delete body.parse_mode; // Fallback for bad HTML
      body.text = text.replace(/<[^>]*>/g, ""); 
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
  } catch (e) {
    console.error("Tg Send Error:", e);
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const token = env.TG_BOT_TOKEN;
  if (!token) return new Response("Error: TG_BOT_TOKEN missing.", { status: 500 });
  
  const url = new URL(request.url);
  if (url.searchParams.get("setup") === "true") {
    const webhookUrl = `${url.origin}/api/admin/telegram`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    return new Response(JSON.stringify(await res.json(), null, 2), { headers: { "Content-Type": "application/json" } });
  }
  return new Response("Bot API OK. Use ?setup=true to bind webhook.");
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const token = env.TG_BOT_TOKEN;
    if (!token) return new Response("Missing Token", { status: 500 });

    const update: any = await request.json();
    const message = update.message || update.edited_message;
    if (!message || !message.text) return new Response('OK');

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const adminId = env.ADMIN_CHAT_ID ? env.ADMIN_CHAT_ID.trim() : "";
    const isAdmin = adminId && chatId === adminId;

    // --- 1. Universal Commands (Everyone) ---
    
    if (text === '/start') {
        await sendTgMessage(token, chatId, "👋 <b>欢迎使用十三水管理机器人</b>\n请使用下方菜单操作：", MAIN_KEYBOARD);
        return new Response('OK');
    }

    if (text === '🆔 我的ID' || text === '/id') {
        await sendTgMessage(token, chatId, `🆔 你的 Chat ID: <code>${chatId}</code>`, MAIN_KEYBOARD);
        return new Response('OK');
    }

    if (text === '❓ 帮助' || text === '/help') {
        await sendTgMessage(token, chatId, 
            "📖 <b>使用说明</b>\n\n" +
            "1. <b>查询用户</b>：点击按钮，然后直接发送手机号。\n" +
            "2. <b>增加积分</b>：直接发送 \"手机号 积分\" (空格隔开)。\n" +
            "3. <b>统计数据</b>：查看当前用户总量。\n\n" +
            "<i>注：涉及数据的操作仅管理员可用。</i>",
            MAIN_KEYBOARD
        );
        return new Response('OK');
    }

    if (text === '🛠 调试信息' || text === '/debug') {
        const info = `DB: ${env.DB ? '✅' : '❌'}\nAdmin: ${isAdmin ? '✅ Verified' : '❌ Mismatch'}\nChatID: ${chatId}`;
        await sendTgMessage(token, chatId, `🛠 <b>系统状态</b>\n${info}`, MAIN_KEYBOARD);
        return new Response('OK');
    }

    // --- 2. Admin Only Commands ---

    if (!isAdmin) {
        // If user tries admin commands/buttons
        if (["📊 统计数据", "🔍 查询用户", "💰 增加积分"].includes(text) || /^\d+/.test(text)) {
             await sendTgMessage(token, chatId, "⛔ <b>无权访问</b>\n请联系管理员将您的 ID 添加到 ADMIN_CHAT_ID。", MAIN_KEYBOARD);
        }
        return new Response('OK');
    }

    // A. Button Clicks
    if (text === '📊 统计数据' || text === '/stats') {
        if (!env.DB) return new Response('OK');
        const u: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
        const t: any = await env.DB.prepare("SELECT count(*) as c FROM game_tables").first();
        await sendTgMessage(token, chatId, `📊 <b>当前数据</b>\n👥 注册用户: ${u?.c || 0}\n🃏 活跃桌子: ${t?.c || 0}`, MAIN_KEYBOARD);
        return new Response('OK');
    }

    if (text === '🔍 查询用户') {
        await sendTgMessage(token, chatId, "🔍 <b>查询模式</b>\n请直接发送 <b>手机号</b> (11位数字)", MAIN_KEYBOARD);
        return new Response('OK');
    }

    if (text === '💰 增加积分') {
        await sendTgMessage(token, chatId, "💰 <b>加分模式</b>\n请发送格式：<code>手机号 积分</code>\n例如：<code>13800000000 5000</code>", MAIN_KEYBOARD);
        return new Response('OK');
    }

    // B. Intelligent Pattern Matching (No Prefix Needed)

    // Pattern 1: Search User (Just 11 digits)
    // Regex: Starts with 1, followed by 10 digits, no spaces inside
    if (/^1\d{10}$/.test(text)) {
        if (!env.DB) return new Response('OK');
        const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(text).first();
        if (user) {
            await sendTgMessage(token, chatId, 
                `👤 <b>用户查询结果</b>\n\n` +
                `🆔 ID: <code>${user.id}</code>\n` +
                `📱 手机: <code>${user.phone}</code>\n` +
                `📛 昵称: ${user.nickname}\n` +
                `💰 积分: <b>${user.points}</b>\n` +
                `📅 注册: ${user.created_at}`,
                MAIN_KEYBOARD
            );
        } else {
            await sendTgMessage(token, chatId, `❌ 未找到手机号为 <code>${text}</code> 的用户。`, MAIN_KEYBOARD);
        }
        return new Response('OK');
    }

    // Pattern 2: Add Points (Phone + Space + Amount)
    // Regex: 11 digits, space(s), number (can be negative)
    const addPointsMatch = text.match(/^(1\d{10})\s+(-?\d+)$/);
    if (addPointsMatch) {
        if (!env.DB) return new Response('OK');
        const phone = addPointsMatch[1];
        const amount = parseInt(addPointsMatch[2]);

        const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
        if (!user) {
            await sendTgMessage(token, chatId, `❌ 用户 ${phone} 不存在。`, MAIN_KEYBOARD);
        } else {
            await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(amount, phone).run();
            const newUser: any = await env.DB.prepare("SELECT points FROM users WHERE phone = ?").bind(phone).first();
            await sendTgMessage(token, chatId, 
                `✅ <b>积分变更成功</b>\n\n` +
                `用户: ${user.nickname}\n` +
                `变动: ${amount > 0 ? '+' : ''}${amount}\n` +
                `当前: <b>${newUser.points}</b>`,
                MAIN_KEYBOARD
            );
        }
        return new Response('OK');
    }

    // Default: Echo or Ignore
    // await sendTgMessage(token, chatId, "🤖 无法识别的指令，请使用下方菜单。", MAIN_KEYBOARD);

    return new Response('OK');
  } catch (e: any) {
    console.error("Handler Error:", e);
    return new Response('OK');
  }
};
