
type D1Result = {
  success: boolean;
  meta: any;
  results?: any[];
};

type D1PreparedStatement = {
  bind: (...args: any[]) => D1PreparedStatement;
  run: () => Promise<D1Result>;
  first: <T = any>(colName?: string) => Promise<T | null>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}) => Promise<Response>;

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  DB: D1Database;
}

// 辅助函数：发送消息
async function sendMessage(token: string, chatId: number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    ...options
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      console.error(`TG Error ${resp.status}:`, await resp.text());
    }
  } catch (e) {
    console.error("Fetch Error:", e);
  }
}

// 辅助函数：HTML 转义
function escapeHtml(text: string): string {
  if (!text) return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const token = env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN.trim() : "";

  if (!token) return new Response("Missing Token", { status: 500 });

  try {
    const body: any = await request.json();

    // 1. 处理支付预检 (Pre-checkout)
    if (body.pre_checkout_query) {
      await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: body.pre_checkout_query.id, ok: true })
      });
      return new Response("OK");
    }

    // 2. 处理支付成功
    if (body.message?.successful_payment) {
      const payment = body.message.successful_payment;
      const user = body.message.from;
      const userId = user.id;
      const username = user.username || user.first_name || "Unknown";

      try {
        const payload = JSON.parse(payment.invoice_payload);
        if (payload.product === "points_2000" && env.DB) {
           // A. 更新用户积分
           await env.DB.prepare("UPDATE users SET points = points + 2000 WHERE telegram_id = ?").bind(userId).run();
           
           // B. 记录账单 (新增)
           await env.DB.prepare(`
             INSERT INTO payments (telegram_id, username, amount, product, telegram_payment_charge_id)
             VALUES (?, ?, ?, ?, ?)
           `).bind(userId, username, payment.total_amount, payload.product, payment.telegram_payment_charge_id).run();

           await sendMessage(token, userId, `✅ <b>支付成功！</b>\n2000 积分已到账。`);
        }
      } catch (e) { console.error("Payment DB Error", e); }
      return new Response("OK");
    }

    // 3. 处理普通消息
    if (body.message?.text) {
      const text = body.message.text;
      const chatId = body.message.chat.id;
      const user = body.message.from;
      const userId = user.id;
      const username = user.username || user.first_name || "玩家";
      const safeName = escapeHtml(username);
      
      const webAppUrl = new URL(request.url).origin;

      const mainKeyboard = {
        keyboard: [
          [{ text: "🎮 开始游戏", web_app: { url: webAppUrl } }],
          [{ text: "💰 我的积分" }, { text: "📅 每日签到" }],
          [{ text: "❓ 帮助说明" }]
        ],
        resize_keyboard: true,
        persistent: true
      };

      const startInlineKeyboard = {
        inline_keyboard: [[{ text: "🚀 启动 Gemini 斗地主", web_app: { url: webAppUrl } }]]
      };

      // A. /start 命令
      if (text === "/start" || text === "🎮 开始游戏") {
        if (env.DB) {
          try {
            await env.DB.prepare(`INSERT OR IGNORE INTO users (telegram_id, username, points) VALUES (?, ?, 1000)`).bind(userId, username).run();
          } catch (e) { console.error("DB Init Error", e); }
        }

        const welcomeMsg = `👋 欢迎 <b>${safeName}</b>！\n\nGemini 斗地主已就绪。\n点击下方按钮开始对局，或使用菜单查询积分。`;
        
        await sendMessage(token, chatId, welcomeMsg, {
          reply_markup: mainKeyboard 
        });
        
        await sendMessage(token, chatId, "👇 点击下方按钮进入 Web App", {
            reply_markup: startInlineKeyboard
        });
        
        return new Response("OK");
      }

      // B. 查询积分
      if (text === "/balance" || text === "💰 我的积分") {
        if (!env.DB) return new Response("OK");
        const userRecord = await env.DB.prepare("SELECT points FROM users WHERE telegram_id = ?").bind(userId).first<any>();
        const points = userRecord ? userRecord.points : 0;
        await sendMessage(token, chatId, `💰 <b>当前积分</b>: ${points}`, { reply_markup: mainKeyboard });
        return new Response("OK");
      }

      // C. 每日签到
      if (text === "/checkin" || text === "📅 每日签到") {
        if (!env.DB) return new Response("OK");
        const today = new Date().toISOString().split('T')[0];
        const userRecord = await env.DB.prepare("SELECT last_check_in_date, points FROM users WHERE telegram_id = ?").bind(userId).first<any>();
        
        if (userRecord && userRecord.last_check_in_date === today) {
           await sendMessage(token, chatId, `📅 您今天已经签到过了！\n当前积分: ${userRecord.points}`, { reply_markup: mainKeyboard });
        } else {
           await env.DB.prepare("UPDATE users SET points = points + 1000, last_check_in_date = ? WHERE telegram_id = ?").bind(today, userId).run();
           await sendMessage(token, chatId, `✅ <b>签到成功！</b>\n获得 1000 积分。\n当前积分: ${(userRecord?.points || 0) + 1000}`, { reply_markup: mainKeyboard });
        }
        return new Response("OK");
      }

      // D. 帮助
      if (text === "/help" || text === "❓ 帮助说明") {
        const helpText = `<b>Gemini 斗地主帮助</b>\n\n` +
          `1. 点击 "🎮 开始游戏" 进入 Web App。\n` +
          `2. 游戏中由 Google Gemini AI 提供出牌建议。\n` +
          `3. 积分不足时可点击 "📅 每日签到" 获取。\n` +
          `4. 如遇问题，请尝试重新输入 /start`;
        await sendMessage(token, chatId, helpText, { reply_markup: mainKeyboard });
        return new Response("OK");
      }
    }

    return new Response("OK");

  } catch (err: any) {
    console.error("Webhook Error:", err);
    return new Response("OK"); 
  }
};
