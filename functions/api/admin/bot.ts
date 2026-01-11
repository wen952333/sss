
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
  all<T = unknown>(): Promise<{ success: boolean; results?: T[] }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  // Keep track of chatId to send error reports back to the user
  let currentChatId: number | null = null;

  try {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Environment variable TELEGRAM_BOT_TOKEN is missing");

    const update: any = await request.json();
    
    // Identify chat ID from either message or callback
    if (update.message) currentChatId = update.message.chat.id;
    else if (update.callback_query) currentChatId = update.callback_query.message.chat.id;

    if (!currentChatId) return new Response("OK"); // No chat context, just acknowledge

    // --- Helpers ---

    const sendMessage = async (chatId: number, text: string, replyMarkup: any = null) => {
        const payload: any = { 
            chat_id: chatId, 
            text: text, 
            parse_mode: 'HTML', 
            disable_web_page_preview: true
        };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        // If HTML parsing fails, fallback to plain text to verify sending works
        if (!res.ok) {
            const errText = await res.text();
            console.error("Telegram Send Error:", errText);
            if (payload.parse_mode) {
                delete payload.parse_mode;
                payload.text = `[System Message] Content sent failed formatting.\n\n${text}`;
                await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
            }
        }
    };

    const answerCallback = async (callbackId: string, text: string, showAlert: boolean = false) => {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                callback_query_id: callbackId, 
                text: text,
                show_alert: showAlert 
            })
        });
    };

    // --- Keyboards ---

    const mainKeyboard = {
        keyboard: [
            [{ text: "📋 最新用户" }, { text: "🔍 搜索用户" }],
            [{ text: "❓ 帮助指令" }]
        ],
        resize_keyboard: true,
        is_persistent: true
    };

    // --- Logic: Check DB ---
    if (!env.DB) {
        await sendMessage(currentChatId, "❌ <b>系统严重错误</b>\n\nD1 数据库未绑定。请在 Cloudflare Pages 设置中将 D1 数据库绑定到变量名 <code>DB</code>。");
        return new Response("OK");
    }

    // --- 1. Handle Callbacks ---
    if (update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data;
        
        if (data === 'ignore') {
            await answerCallback(cb.id, "");
            return new Response("OK");
        }

        const parts = data.split(':');
        const action = parts[0];
        const uid = parts[1];

        if (action === 'mod') {
            const amount = parseInt(parts[2]);
            await env.DB.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(amount, uid).run();
            const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(uid).first<{nickname: string, points: number}>();
            
            if (u) {
                await answerCallback(cb.id, `✅ 成功! ${u.nickname} 现分: ${u.points}`, true);
            } else {
                await answerCallback(cb.id, "❌ 用户不存在", true);
            }
        } 
        else if (action === 'del') {
            await env.DB.prepare('DELETE FROM Users WHERE id = ?').bind(uid).run();
            await answerCallback(cb.id, `🗑 用户 ${uid} 已删除`, true);
            await sendMessage(currentChatId, `⚠️ 用户 ID ${uid} 已被删除。`);
        }

        return new Response("OK");
    }

    // --- 2. Handle Text ---
    if (!update.message || !update.message.text) return new Response("OK");

    let text = update.message.text.trim();
    
    // Menu Mapping
    if (text === "📋 最新用户") text = "/list";
    if (text === "❓ 帮助指令") text = "/help";
    if (text === "🔍 搜索用户") {
        await sendMessage(currentChatId, "🔎 请回复: <code>/search 手机号</code> 或 <code>/search 昵称</code>", mainKeyboard);
        return new Response("OK");
    }

    const args = text.split(' ');
    const command = args[0].toLowerCase();

    if (command === '/start') {
        // Test DB connectivity
        let dbStatus = "✅ 数据库正常";
        try {
            await env.DB.prepare('SELECT 1').first();
        } catch (e: any) {
            dbStatus = `❌ 数据库连接失败: ${e.message}`;
        }

        await sendMessage(
            currentChatId, 
            `<b>👋 欢迎使用十三水 GM 管理后台</b>\n\n系统检查: ${dbStatus}\n\n点击下方按钮进行操作。`, 
            mainKeyboard
        );
    }

    else if (command === '/list') {
        const users = await env.DB.prepare('SELECT * FROM Users ORDER BY id DESC LIMIT 5').all<{ id: number, nickname: string, phone: string, points: number }>();
        
        if(!users.results || users.results.length === 0) {
            await sendMessage(currentChatId, "📭 暂无用户数据", mainKeyboard);
        } else {
            await sendMessage(currentChatId, `📋 <b>最新 ${users.results.length} 位用户:</b>`, mainKeyboard);
            for (const u of users.results) {
                const info = `🆔 <code>${u.id}</code> | 👤 <b>${u.nickname}</b>\n📱 <code>${u.phone}</code>\n💰 积分: <b>${u.points}</b>`;
                const inlineMarkup = {
                    inline_keyboard: [
                        [
                            { text: "💰 +1000", callback_data: `mod:${u.id}:1000` },
                            { text: "💸 -1000", callback_data: `mod:${u.id}:-1000` }
                        ],
                        [
                            { text: "❌ 删除", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(currentChatId, info, inlineMarkup);
            }
        }
    }

    else if (command === '/search' || command === '/find') {
        const query = args[1];
        if (!query) { await sendMessage(currentChatId, "❌ 用法: <code>/search 13800000000</code>", mainKeyboard); return new Response("OK"); }
        
        let results = await env.DB.prepare('SELECT * FROM Users WHERE phone = ?').bind(query).all<{ id: number, nickname: string, phone: string, points: number }>();
        if (!results.results || results.results.length === 0) {
            results = await env.DB.prepare('SELECT * FROM Users WHERE nickname LIKE ?').bind(`%${query}%`).all();
        }

        if (!results.results || results.results.length === 0) {
            await sendMessage(currentChatId, "⚠️ 未找到匹配用户", mainKeyboard);
        } else {
            for (const u of results.results) {
                const info = `🎯 <b>搜索结果</b>\n\n🆔 ID: <code>${u.id}</code>\n👤 昵称: <b>${u.nickname}</b>\n📱 手机: <code>${u.phone}</code>\n💰 积分: <b>${u.points}</b>`;
                const inlineMarkup = {
                    inline_keyboard: [
                        [
                            { text: "💰 +5000", callback_data: `mod:${u.id}:5000` },
                            { text: "💰 +1000", callback_data: `mod:${u.id}:1000` },
                            { text: "💸 -1000", callback_data: `mod:${u.id}:-1000` }
                        ],
                        [
                            { text: "❌ 删除", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(currentChatId, info, inlineMarkup);
            }
        }
    }

    else if (command === '/mod') {
        const id = args[1];
        const amount = parseInt(args[2]);
        if (!id || isNaN(amount)) { await sendMessage(currentChatId, "用法: <code>/mod ID 金额</code>", mainKeyboard); return new Response("OK"); }

        await env.DB.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(amount, id).run();
        const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(id).first<{ nickname: string, points: number }>();
        if (u) {
            await sendMessage(currentChatId, `✅ 操作成功\n用户: ${u.nickname}\n当前积分: ${u.points}`, mainKeyboard);
        } else {
            await sendMessage(currentChatId, "❌ 用户不存在", mainKeyboard);
        }
    }

    else if (command === '/help') {
        const msg = `<b>🛠 管理员指令帮助</b>\n\n` +
                    `<b>/search 手机号</b> - 查找用户\n` +
                    `<b>/list</b> - 最新用户\n` +
                    `<b>/mod ID 金额</b> - 修改积分\n\n` +
                    `<i>请直接点击底部菜单按钮。</i>`;
        await sendMessage(currentChatId, msg, mainKeyboard);
    }

    return new Response("OK");

  } catch (e: any) {
    // Critical Error Handler: Try to send the error to the chat
    if (currentChatId && env.TELEGRAM_BOT_TOKEN) {
        try {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    chat_id: currentChatId, 
                    text: `⚠️ <b>BOT INTERNAL ERROR</b>\n<pre>${e.message}</pre>`,
                    parse_mode: 'HTML'
                })
            });
        } catch(ignore) {}
    }
    // Always return 200 OK to Telegram so it stops retrying the failing update
    return new Response("OK");
  }
};
