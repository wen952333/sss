
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

// Updated Keyboard Definition (Cleaner, Admin-focused)
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "📊 统计数据" }, { text: "🏆 积分榜" }],
    [{ text: "👥 用户列表" }, { text: "🔍 查询用户" }],
    [{ text: "💰 增加积分" }, { text: "❌ 删除用户" }]
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
      delete body.parse_mode; // Fallback
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
    
    // Strict Admin Check for ALL operations
    if (!adminId || chatId !== adminId) {
        if (text === '/id' || text === 'id') {
            await sendTgMessage(token, chatId, `Your ID: <code>${chatId}</code>`);
        }
        return new Response('OK');
    }

    // --- Admin Commands ---

    if (text === '/start') {
        await sendTgMessage(token, chatId, "👋 <b>管理员控制台</b>", MAIN_KEYBOARD);
        return new Response('OK');
    }

    // 1. Button: Stats
    if (text === '📊 统计数据') {
        if (!env.DB) return new Response('OK');
        const u: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
        const t: any = await env.DB.prepare("SELECT count(*) as c FROM game_tables").first();
        await sendTgMessage(token, chatId, `📊 <b>统计</b>\n👥 用户: ${u?.c || 0}\n🃏 桌子: ${t?.c || 0}`, MAIN_KEYBOARD);
        return new Response('OK');
    }

    // 2. Button: Rank List (Top 10)
    if (text === '🏆 积分榜') {
        if (!env.DB) return new Response('OK');
        const { results } = await env.DB.prepare("SELECT nickname, phone, points FROM users ORDER BY points DESC LIMIT 10").all();
        
        if (!results || results.length === 0) {
            await sendTgMessage(token, chatId, "暂无用户数据。", MAIN_KEYBOARD);
        } else {
            let msg = "🏆 <b>积分排行榜 (Top 10)</b>\n\n";
            results.forEach((u: any, i: number) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                msg += `${medal} <b>${u.nickname}</b> (${u.phone})\n   💰 ${u.points}\n`;
            });
            await sendTgMessage(token, chatId, msg, MAIN_KEYBOARD);
        }
        return new Response('OK');
    }

    // 3. Button: User List (Recent 20)
    if (text === '👥 用户列表') {
        if (!env.DB) return new Response('OK');
        const { results } = await env.DB.prepare("SELECT nickname, phone, points FROM users ORDER BY created_at DESC LIMIT 20").all();
        
        if (!results || results.length === 0) {
            await sendTgMessage(token, chatId, "暂无用户数据。", MAIN_KEYBOARD);
        } else {
            let msg = "👥 <b>最新用户列表 (Top 20)</b>\n\n";
            results.forEach((u: any) => {
                msg += `👤 <b>${u.nickname}</b> | 📱 <code>${u.phone}</code>\n   💰 ${u.points}\n`;
            });
            await sendTgMessage(token, chatId, msg, MAIN_KEYBOARD);
        }
        return new Response('OK');
    }

    // 4. Button: Search Help
    if (text === '🔍 查询用户') {
        await sendTgMessage(token, chatId, "🔍 <b>查询</b>\n直接发送手机号 (如 <code>13800000000</code>)", MAIN_KEYBOARD);
        return new Response('OK');
    }

    // 5. Button: Add Points Help
    if (text === '💰 增加积分') {
        await sendTgMessage(token, chatId, "💰 <b>加分</b>\n发送: <code>手机号 金额</code>\n例: <code>13800000000 5000</code>", MAIN_KEYBOARD);
        return new Response('OK');
    }

    // 6. Button: Delete User Help
    if (text === '❌ 删除用户') {
        await sendTgMessage(token, chatId, "⚠️ <b>删除用户</b>\n发送: <code>删除 手机号</code>\n例: <code>删除 13800000000</code>", MAIN_KEYBOARD);
        return new Response('OK');
    }

    // --- Intelligent Text Matching ---

    // A. Search (Pure Phone Number)
    if (/^1\d{10}$/.test(text)) {
        if (!env.DB) return new Response('OK');
        const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(text).first();
        if (user) {
            await sendTgMessage(token, chatId, 
                `👤 <b>用户详情</b>\n` +
                `📱 <code>${user.phone}</code>\n` +
                `📛 ${user.nickname}\n` +
                `💰 ${user.points}\n` +
                `🆔 ${user.id}`,
                MAIN_KEYBOARD
            );
        } else {
            await sendTgMessage(token, chatId, `❌ 未找到: ${text}`, MAIN_KEYBOARD);
        }
        return new Response('OK');
    }

    // B. Add Points (Phone + Amount)
    const addPointsMatch = text.match(/^(1\d{10})\s+(-?\d+)$/);
    if (addPointsMatch) {
        if (!env.DB) return new Response('OK');
        const phone = addPointsMatch[1];
        const amount = parseInt(addPointsMatch[2]);
        
        const check: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
        if (!check) {
             await sendTgMessage(token, chatId, `❌ 用户 ${phone} 不存在`, MAIN_KEYBOARD);
             return new Response('OK');
        }

        await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(amount, phone).run();
        const user: any = await env.DB.prepare("SELECT points, nickname FROM users WHERE phone = ?").bind(phone).first();
        await sendTgMessage(token, chatId, 
            `✅ <b>已加分</b>\n` +
            `用户: ${user.nickname}\n` +
            `变动: ${amount > 0 ? '+' : ''}${amount}\n` +
            `当前: <b>${user.points}</b>`,
            MAIN_KEYBOARD
        );
        return new Response('OK');
    }

    // C. Delete User (Delete + Phone)
    const delUserMatch = text.match(/^(?:删除|delete|del)\s+(1\d{10})$/i);
    if (delUserMatch) {
        if (!env.DB) return new Response('OK');
        const phone = delUserMatch[1];
        
        const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
        if (!user) {
            await sendTgMessage(token, chatId, `❌ 用户 ${phone} 不存在`, MAIN_KEYBOARD);
        } else {
            await env.DB.prepare("DELETE FROM users WHERE phone = ?").bind(phone).run();
            await sendTgMessage(token, chatId, 
                `🗑 <b>已删除用户</b>\n` +
                `昵称: ${user.nickname}\n` +
                `手机: ${phone}\n` +
                `数据已清除。`,
                MAIN_KEYBOARD
            );
        }
        return new Response('OK');
    }

    return new Response('OK');
  } catch (e: any) {
    console.error("Handler Error:", e);
    return new Response('OK');
  }
};
