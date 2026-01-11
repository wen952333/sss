
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
  try {
    const update: any = await request.json();

    // --- Helper Functions ---

    const sendMessage = async (chatId: number, text: string, replyMarkup: any = null) => {
        const payload: any = { 
            chat_id: chatId, 
            text: text, 
            parse_mode: 'HTML', // Enable bold/code styles
            disable_web_page_preview: true
        };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
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

    // --- Keyboards Definition ---

    const mainKeyboard = {
        keyboard: [
            [{ text: "📋 最新用户" }, { text: "🔍 搜索用户" }],
            [{ text: "❓ 帮助指令" }]
        ],
        resize_keyboard: true, // Make keyboard compact
        is_persistent: true
    };

    // --- 1. Handle Inline Button Clicks (Callbacks) ---
    
    if (update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data; // e.g. "mod:101:1000"
        const chatId = cb.message.chat.id;
        
        // Ignore placeholders
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
            
            // Get updated info
            const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(uid).first<{nickname: string, points: number}>();
            if (u) {
                await answerCallback(cb.id, `✅ 成功! ${u.nickname} 当前积分: ${u.points}`, true);
            } else {
                await answerCallback(cb.id, "❌ 用户不存在", true);
            }
        } 
        else if (action === 'del') {
            await env.DB.prepare('DELETE FROM Users WHERE id = ?').bind(uid).run();
            await answerCallback(cb.id, `🗑 用户 ID ${uid} 已删除`, true);
            await sendMessage(chatId, `⚠️ 用户 ID ${uid} 已被管理员删除。`);
        }

        return new Response("OK");
    }

    // --- 2. Handle Text Messages ---

    if (!update.message || !update.message.text) return new Response("OK");

    const chatId = update.message.chat.id;
    let text = update.message.text.trim();
    
    // Map Menu Buttons to Commands
    if (text === "📋 最新用户") text = "/list";
    if (text === "❓ 帮助指令") text = "/help";
    if (text === "🔍 搜索用户") {
        await sendMessage(chatId, "🔎 请回复搜索指令:\n<code>/search 手机号</code>\n或\n<code>/search 昵称</code>", mainKeyboard);
        return new Response("OK");
    }

    const args = text.split(' ');
    const command = args[0].toLowerCase();

    // --- Command Logic ---

    if (command === '/start') {
        await sendMessage(
            chatId, 
            "<b>👋 欢迎使用十三水 GM 管理后台</b>\n\n点击下方键盘按钮进行快捷操作。", 
            mainKeyboard
        );
    }

    else if (command === '/list') {
        const users = await env.DB.prepare('SELECT * FROM Users ORDER BY id DESC LIMIT 5').all<{ id: number, nickname: string, phone: string, points: number }>();
        
        if(!users.results || users.results.length === 0) {
            await sendMessage(chatId, "暂无用户", mainKeyboard);
        } else {
            await sendMessage(chatId, "📋 <b>最新注册的 5 位用户:</b>", mainKeyboard);
            
            // Send each user as an individual card with buttons
            for (const u of users.results) {
                const info = `🆔 <code>${u.id}</code> | 👤 <b>${u.nickname}</b>\n📱 <code>${u.phone}</code>\n💰 积分: <b>${u.points}</b>`;
                const inlineMarkup = {
                    inline_keyboard: [
                        [
                            { text: "💰 +1000", callback_data: `mod:${u.id}:1000` },
                            { text: "💸 -1000", callback_data: `mod:${u.id}:-1000` }
                        ],
                        [
                            { text: "❌ 删除此人", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(chatId, info, inlineMarkup);
            }
        }
    }

    else if (command === '/search' || command === '/find') {
        const query = args[1];
        if (!query) { await sendMessage(chatId, "❌ 用法: <code>/search 13800000000</code>", mainKeyboard); return new Response("OK"); }
        
        // Search by phone matches exact, nickname matches fuzzy
        let results = await env.DB.prepare('SELECT * FROM Users WHERE phone = ?').bind(query).all<{ id: number, nickname: string, phone: string, points: number }>();
        if (!results.results || results.results.length === 0) {
            results = await env.DB.prepare('SELECT * FROM Users WHERE nickname LIKE ?').bind(`%${query}%`).all();
        }

        if (!results.results || results.results.length === 0) {
            await sendMessage(chatId, "⚠️ 未找到匹配用户", mainKeyboard);
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
                            { text: "❌ 删号跑路", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(chatId, info, inlineMarkup);
            }
        }
    }

    else if (command === '/mod') {
        const id = args[1];
        const amount = parseInt(args[2]);
        if (!id || isNaN(amount)) { await sendMessage(chatId, "用法: <code>/mod ID 金额</code>", mainKeyboard); return new Response("OK"); }

        await env.DB.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(amount, id).run();
        const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(id).first<{ nickname: string, points: number }>();
        if (u) {
            await sendMessage(chatId, `✅ 操作成功\n用户: ${u.nickname}\n当前积分: ${u.points}`, mainKeyboard);
        } else {
            await sendMessage(chatId, "❌ 用户不存在", mainKeyboard);
        }
    }

    else if (command === '/help') {
        const msg = `<b>🛠 管理员指令帮助</b>\n\n` +
                    `<b>/search 手机号</b> - 精确查找用户\n` +
                    `<b>/list</b> - 查看最新注册用户\n` +
                    `<b>/mod ID 金额</b> - 手动修改积分\n` +
                    `<b>/del ID</b> - 删除用户\n\n` +
                    `<i>💡 提示: 搜索或列表显示用户后，直接点击下方按钮可快速加分或删除。</i>`;
        await sendMessage(chatId, msg, mainKeyboard);
    }

    return new Response("OK");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
