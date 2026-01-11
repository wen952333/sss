
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

    const sendMessage = async (chatId: number, text: string, options: any = {}) => {
        const payload: any = { 
            chat_id: chatId, 
            text: text, 
            parse_mode: 'HTML', 
            disable_web_page_preview: true,
            ...options
        };
        
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error("Telegram Send Error:", await res.text());
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

    const mainKeyboard = {
        keyboard: [
            [{ text: "➕ 增加积分" }, { text: "➖ 减少积分" }],
            [{ text: "🔍 搜索用户" }, { text: "📋 最新用户" }],
            [{ text: "❓ 帮助" }]
        ],
        resize_keyboard: true,
        is_persistent: true
    };

    if (!env.DB) {
        await sendMessage(currentChatId, "❌ <b>系统错误</b>: D1 数据库未连接。", { reply_markup: mainKeyboard });
        return new Response("OK");
    }

    // --- 1. Handle Callbacks (Inline Buttons from Search Results) ---
    if (update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data;
        const parts = data.split(':'); // action:uid
        const action = parts[0];
        const uid = parts[1];

        if (action === 'add' || action === 'sub') {
            await answerCallback(cb.id, "请回复金额");
            const user = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(uid).first<{nickname: string, points: number}>();
            if(user) {
                const modeText = action === 'add' ? '增加' : '减少';
                const prompt = `🆔 <b>ID: [${uid}]</b>\n👤 用户: ${user.nickname}\n💰 当前积分: ${user.points}\n\n✍️ <b>【${modeText}模式】</b> 请输入要${modeText}的数值:`;
                await sendMessage(currentChatId, prompt, {
                    reply_markup: { force_reply: true, input_field_placeholder: "请输入整数..." }
                });
            } else {
                await sendMessage(currentChatId, "❌ 用户不存在");
            }
        } 
        else if (action === 'del') {
            await env.DB.prepare('DELETE FROM Users WHERE id = ?').bind(uid).run();
            await answerCallback(cb.id, `🗑 用户 ${uid} 已删除`, true);
            await sendMessage(currentChatId, `⚠️ 用户 ID ${uid} 已被删除。`);
        } 
        else {
            await answerCallback(cb.id, "");
        }

        return new Response("OK");
    }

    // --- 2. Handle Text Messages ---
    if (!update.message || !update.message.text) return new Response("OK");

    let text = update.message.text.trim();
    
    // --- 2.1 Handle Force Reply Logic (The State Machine) ---
    if (update.message.reply_to_message && update.message.reply_to_message.text) {
        const replyText = update.message.reply_to_message.text;

        // SCENARIO A: Processing Phone Number Input (Step 2 -> Step 3)
        if (replyText.includes('请输入目标用户的手机号')) {
            const isAddMode = replyText.includes('【充值】');
            const phone = text; // User input phone

            // Find User
            const user = await env.DB.prepare('SELECT id, nickname, points FROM Users WHERE phone = ?').bind(phone).first<{id: number, nickname: string, points: number}>();
            
            if (!user) {
                await sendMessage(currentChatId, `❌ 未找到手机号为 <b>${phone}</b> 的用户，请重新操作。`, { reply_markup: mainKeyboard });
            } else {
                const modeText = isAddMode ? '增加' : '减少';
                const actionKey = isAddMode ? 'add' : 'sub'; // reuse format if we wanted, but here we build text
                // Send Next Step
                const prompt = `🆔 <b>ID: [${user.id}]</b>\n👤 用户: ${user.nickname}\n📱 手机: ${phone}\n💰 当前积分: ${user.points}\n\n✍️ <b>【${modeText}模式】</b> 请输入要${modeText}的数值:`;
                
                await sendMessage(currentChatId, prompt, {
                    reply_markup: { force_reply: true, input_field_placeholder: "请输入整数金额" }
                });
            }
            return new Response("OK");
        }

        // SCENARIO B: Processing Amount Input (Step 3 -> Step 4)
        // Regex looks for "ID: [123]" and "【增加模式】" or "【减少模式】" in the prompt text
        const idMatch = replyText.match(/ID: \[(\d+)\]/);
        const modeMatch = replyText.match(/【(.*?)模式】/);

        if (idMatch && modeMatch) {
            const targetId = idMatch[1];
            const mode = modeMatch[1]; // "增加" or "减少"
            let amount = parseInt(text);

            if (isNaN(amount) || amount < 0) {
                await sendMessage(currentChatId, "❌ 格式错误，请输入正整数 (例如: 1000)", { reply_markup: mainKeyboard });
                return new Response("OK");
            }

            // Determine final delta
            let finalDelta = amount;
            if (mode === '减少') finalDelta = -amount;

            // Execute DB Update
            await env.DB.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(finalDelta, targetId).run();
            
            // Fetch updated info
            const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(targetId).first<{nickname: string, points: number}>();
            
            if (u) {
                const emoji = finalDelta > 0 ? '📈' : '📉';
                await sendMessage(currentChatId, 
                    `✅ <b>修改成功</b>\n\n👤 用户: ${u.nickname}\n${emoji} 变动: <b>${finalDelta > 0 ? '+'+finalDelta : finalDelta}</b>\n💰 现分: <b>${u.points}</b>`, 
                    { reply_markup: mainKeyboard }
                );
            } else {
                await sendMessage(currentChatId, "❌ 用户不存在", { reply_markup: mainKeyboard });
            }
            return new Response("OK");
        }
    }

    // --- 2.2 Standard Commands ---
    
    // Command Normalization
    if (text === "📋 最新用户") text = "/list";
    else if (text === "❓ 帮助") text = "/help";
    else if (text === "🔍 搜索用户") {
        await sendMessage(currentChatId, "🔎 <b>搜索模式</b>\n\n请直接输入用户的 <b>手机号</b> 或 <b>昵称</b>。", { reply_markup: mainKeyboard });
        return new Response("OK");
    }
    // New Button Commands
    else if (text === "➕ 增加积分") {
        await sendMessage(currentChatId, "👋 <b>【充值】请输入目标用户的手机号:</b>", {
            reply_markup: { force_reply: true, input_field_placeholder: "输入手机号..." }
        });
        return new Response("OK");
    }
    else if (text === "➖ 减少积分") {
        await sendMessage(currentChatId, "👋 <b>【扣除】请输入目标用户的手机号:</b>", {
            reply_markup: { force_reply: true, input_field_placeholder: "输入手机号..." }
        });
        return new Response("OK");
    }

    let command = '';
    let args: string[] = [];

    if (text.startsWith('/')) {
        args = text.split(/\s+/);
        command = args[0].toLowerCase();
    } else {
        // Treat plain text as search if it's potentially a phone or name
        command = '/search';
        args = ['/search', text];
    }

    // --- Command Logic ---

    if (command === '/start') {
        await sendMessage(currentChatId, `<b>👋 十三水管理员后台</b>\n\n请选择下方按钮进行操作。`, { reply_markup: mainKeyboard });
    }

    else if (command === '/list') {
        const users = await env.DB.prepare('SELECT * FROM Users ORDER BY id DESC LIMIT 5').all<{ id: number, nickname: string, phone: string, points: number }>();
        
        if(!users.results || users.results.length === 0) {
            await sendMessage(currentChatId, "📭 暂无用户数据", { reply_markup: mainKeyboard });
        } else {
            await sendMessage(currentChatId, `📋 <b>最新 5 位注册用户:</b>`, { reply_markup: mainKeyboard });
            for (const u of users.results) {
                const info = `🆔 <code>${u.id}</code> | 👤 <b>${u.nickname}</b>\n📱 <code>${u.phone}</code>\n💰 积分: <b>${u.points}</b>`;
                const inlineMarkup = {
                    inline_keyboard: [
                        [
                            { text: "➕ 加分", callback_data: `add:${u.id}` },
                            { text: "➖ 减分", callback_data: `sub:${u.id}` },
                            { text: "❌ 删除", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(currentChatId, info, { reply_markup: inlineMarkup });
            }
        }
    }

    else if (command === '/search') {
        const query = args.slice(1).join(' ');
        if (!query) { await sendMessage(currentChatId, "❌ 请输入搜索内容", { reply_markup: mainKeyboard }); return new Response("OK"); }
        
        // Try Phone Exact Match
        let results = await env.DB.prepare('SELECT * FROM Users WHERE phone = ?').bind(query).all<{ id: number, nickname: string, phone: string, points: number }>();
        
        // Try Nickname Fuzzy Match
        if (!results.results || results.results.length === 0) {
            results = await env.DB.prepare('SELECT * FROM Users WHERE nickname LIKE ?').bind(`%${query}%`).all();
        }

        if (!results.results || results.results.length === 0) {
            await sendMessage(currentChatId, `⚠️ 未找到 "<b>${query}</b>"`, { reply_markup: mainKeyboard });
        } else {
            const hits = results.results.slice(0, 5); 
            await sendMessage(currentChatId, `🔎 <b>搜索结果:</b>`, { reply_markup: mainKeyboard });
            for (const u of hits) {
                const info = `👤 <b>${u.nickname}</b>\n🆔 <code>${u.id}</code>\n📱 <code>${u.phone}</code>\n💰 积分: <b>${u.points}</b>`;
                const inlineMarkup = {
                    inline_keyboard: [
                        [
                            { text: "➕ 加分", callback_data: `add:${u.id}` },
                            { text: "➖ 减分", callback_data: `sub:${u.id}` },
                            { text: "❌ 删除", callback_data: `del:${u.id}` }
                        ]
                    ]
                };
                await sendMessage(currentChatId, info, { reply_markup: inlineMarkup });
            }
        }
    }

    return new Response("OK");

  } catch (e: any) {
    if (currentChatId && env.TELEGRAM_BOT_TOKEN) {
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: currentChatId, text: `⚠️ Error: ${e.message}` })
        }).catch(()=>{});
    }
    return new Response("OK");
  }
};
