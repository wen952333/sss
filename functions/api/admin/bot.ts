
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
  
  let currentChatId: number | null = null;

  try {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Environment variable TELEGRAM_BOT_TOKEN is missing");

    const update: any = await request.json();
    
    if (update.message) currentChatId = update.message.chat.id;
    else if (update.callback_query) currentChatId = update.callback_query.message.chat.id;

    if (!currentChatId) return new Response("OK");

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

        if (!res.ok) {
            // Fallback if HTML is invalid
            const errText = await res.text();
            console.error("Telegram Send Error:", errText);
            if (payload.parse_mode) {
                delete payload.parse_mode;
                payload.text = text; // Send raw text
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
            [{ text: "❓ 帮助" }]
        ],
        resize_keyboard: true,
        is_persistent: true
    };

    // --- DB Check ---
    if (!env.DB) {
        await sendMessage(currentChatId, "❌ <b>系统错误</b>: D1 数据库未连接。");
        return new Response("OK");
    }

    // --- 1. Handle Callbacks (Inline Buttons) ---
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
                // Optionally update the message text here to reflect new score, but alert is usually enough
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

    // --- 2. Handle Text Messages ---
    if (!update.message || !update.message.text) return new Response("OK");

    let text = update.message.text.trim();
    
    // --- Pre-processing: Menu Buttons -> Virtual Commands ---
    if (text === "📋 最新用户") {
        text = "/list";
    } else if (text === "❓ 帮助" || text === "❓ 帮助指令") {
        text = "/help";
    } else if (text === "🔍 搜索用户") {
        await sendMessage(currentChatId, "🔎 <b>搜索模式</b>\n\n请直接输入用户的 <b>手机号</b> 或 <b>昵称</b>，机器人将自动查找。", mainKeyboard);
        return new Response("OK");
    }

    // --- Command Parsing ---
    let command = '';
    let args: string[] = [];

    if (text.startsWith('/')) {
        // Explicit command
        args = text.split(/\s+/); // split by whitespace
        command = args[0].toLowerCase();
    } else {
        // Implicit Search: Assume any non-command text is a search query
        // Unless it matches specific patterns (reserved for future use)
        command = '/search';
        args = ['/search', text];
    }

    // --- Command Logic ---

    if (command === '/start') {
        let dbStatus = "✅ 数据库正常";
        try { await env.DB.prepare('SELECT 1').first(); } catch (e: any) { dbStatus = `❌ 连接失败: ${e.message}`; }

        await sendMessage(
            currentChatId, 
            `<b>👋 欢迎使用十三水 GM 管理后台</b>\n\n系统状态: ${dbStatus}\n\n您可以点击下方按钮，或直接输入 <b>手机号/昵称</b> 进行搜索。`, 
            mainKeyboard
        );
    }

    else if (command === '/list') {
        const users = await env.DB.prepare('SELECT * FROM Users ORDER BY id DESC LIMIT 5').all<{ id: number, nickname: string, phone: string, points: number }>();
        
        if(!users.results || users.results.length === 0) {
            await sendMessage(currentChatId, "📭 暂无用户数据", mainKeyboard);
        } else {
            await sendMessage(currentChatId, `📋 <b>最新注册用户 (Top 5):</b>`, mainKeyboard);
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
        // args[1] contains the query (either from /search 123 or implicit '123')
        // If implicit, args[1] is the whole text.
        const query = args.slice(1).join(' '); // Join remaining args to allow spaces in nickname
        
        if (!query) { 
            await sendMessage(currentChatId, "❌ 请输入搜索内容", mainKeyboard); 
            return new Response("OK"); 
        }
        
        // Search by exact phone OR fuzzy nickname
        let results = await env.DB.prepare('SELECT * FROM Users WHERE phone = ?').bind(query).all<{ id: number, nickname: string, phone: string, points: number }>();
        
        // If no exact phone match, try fuzzy nickname
        if (!results.results || results.results.length === 0) {
            results = await env.DB.prepare('SELECT * FROM Users WHERE nickname LIKE ?').bind(`%${query}%`).all();
        }

        if (!results.results || results.results.length === 0) {
            await sendMessage(currentChatId, `⚠️ 未找到匹配 "<b>${query}</b>" 的用户`, mainKeyboard);
        } else {
            // Limit search results to avoid spamming
            const hits = results.results.slice(0, 5); 
            
            await sendMessage(currentChatId, `🔎 <b>搜索结果 (${hits.length} 条):</b>`, mainKeyboard);

            for (const u of hits) {
                const info = `👤 <b>${u.nickname}</b>\n🆔 <code>${u.id}</code>\n📱 <code>${u.phone}</code>\n💰 积分: <b>${u.points}</b>`;
                const inlineMarkup = {
                    inline_keyboard: [
                        [
                            { text: "💰 +5000", callback_data: `mod:${u.id}:5000` },
                            { text: "💰 +1000", callback_data: `mod:${u.id}:1000` },
                            { text: "💸 -1000", callback_data: `mod:${u.id}:-1000` }
                        ],
                        [
                             { text: "✏️ 改名", callback_data: `ignore` }, // Placeholder
                             { text: "❌ 删除", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(currentChatId, info, inlineMarkup);
            }
        }
    }

    else if (command === '/mod') {
        // Keep manual mod command for custom amounts
        const id = args[1];
        const amount = parseInt(args[2]);
        if (!id || isNaN(amount)) { 
            await sendMessage(currentChatId, "ℹ️ <b>高级修改</b>\n用法: <code>/mod ID 金额</code>\n例如: <code>/mod 101 50000</code>", mainKeyboard); 
            return new Response("OK"); 
        }

        await env.DB.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(amount, id).run();
        const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(id).first<{ nickname: string, points: number }>();
        if (u) {
            await sendMessage(currentChatId, `✅ <b>修改成功</b>\n用户: ${u.nickname}\n当前积分: ${u.points}`, mainKeyboard);
        } else {
            await sendMessage(currentChatId, "❌ 用户不存在", mainKeyboard);
        }
    }

    else if (command === '/help') {
        const msg = `<b>🛠 管理员操作指南</b>\n\n` +
                    `1️⃣ <b>搜索用户</b>\n直接发送手机号或昵称。\n` +
                    `2️⃣ <b>查看最新</b>\n点击底部菜单 "📋 最新用户"。\n` +
                    `3️⃣ <b>修改积分</b>\n搜索出用户后，点击下方按钮加减分。\n` +
                    `4️⃣ <b>手动指令</b>\n<code>/mod ID 金额</code> (支持负数)\n<code>/del ID</code> (删号)`;
        await sendMessage(currentChatId, msg, mainKeyboard);
    }

    return new Response("OK");

  } catch (e: any) {
    if (currentChatId && env.TELEGRAM_BOT_TOKEN) {
        try {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    chat_id: currentChatId, 
                    text: `⚠️ <b>SYSTEM ERROR</b>\n<pre>${e.message}</pre>`,
                    parse_mode: 'HTML'
                })
            });
        } catch(ignore) {}
    }
    return new Response("OK");
  }
};
