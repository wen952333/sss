
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

// Helper to send messages with fallback
async function sendTgMessage(token: string, chatId: string, text: string, replyMarkup: any = null) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const headers = { 'Content-Type': 'application/json' };
    
    // Try sending with HTML parsing
    let body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;

    let response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    // If HTML parsing fails (400 Bad Request), retry as plain text
    if (response.status === 400) {
      console.warn("HTML send failed, retrying as text...");
      delete body.parse_mode;
      // Strip simple tags for readability if possible, or just send raw
      body.text = text.replace(/<b>|<\/b>|<code>|<\/code>|<pre>|<\/pre>/g, ""); 
      await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    }
  } catch (e) {
    console.error("Send Error:", e);
  }
}

// GET Handler: Webhook Setup
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const token = env.TG_BOT_TOKEN ? env.TG_BOT_TOKEN.trim() : "";
  if (!token) return new Response("Error: TG_BOT_TOKEN missing.", { status: 500 });

  const url = new URL(request.url);
  const setup = url.searchParams.get("setup");

  if (setup === "true") {
    const webhookUrl = `${url.origin}/api/admin/telegram`;
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const tgData = await tgRes.json();
      return new Response(JSON.stringify({ status: "Webhook Request Sent", webhook_url: webhookUrl, telegram_response: tgData }, null, 2), 
        { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response(
    "Telegram Bot API Normal.\n" +
    "👉 Access this URL with ?setup=true to configure webhook.\n" +
    `Example: ${url.origin}/api/admin/telegram?setup=true`,
    { headers: { "Content-Type": "text/plain" } }
  );
};

// POST Handler: Message Processing
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const token = env.TG_BOT_TOKEN ? env.TG_BOT_TOKEN.trim() : "";
    if (!token) return new Response("Missing Token", { status: 500 });

    const update: any = await request.json();
    
    // Handle specific updates or ignore unknown ones
    if (!update.message && !update.edited_message) return new Response('OK');

    const message = update.message || update.edited_message;
    const chatId = String(message.chat.id);
    const text = (message.text || "").trim();
    
    // Log for debugging
    console.log(`Msg from ${chatId}: ${text}`);

    // If no text (e.g. sticker), ignore or reply generic
    if (!text) return new Response('OK');

    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);

    // --- Public Commands ---

    if (command === '/ping') {
        await sendTgMessage(token, chatId, "🏓 <b>Pong!</b> 服务正常。");
        return new Response('OK');
    }

    if (command === '/id') {
        await sendTgMessage(token, chatId, `🆔 Your ID: <code>${chatId}</code>`);
        return new Response('OK');
    }

    if (command === '/debug') {
        const dbStatus = env.DB ? "✅ Connected" : "❌ Missing";
        const adminStatus = env.ADMIN_CHAT_ID ? "✅ Configured" : "⚠️ Not set";
        await sendTgMessage(token, chatId, `🛠 <b>Debug Info</b>\nDB: ${dbStatus}\nAdmin Config: ${adminStatus}`);
        return new Response('OK');
    }

    // --- Admin Commands ---
    
    const adminId = env.ADMIN_CHAT_ID ? env.ADMIN_CHAT_ID.trim() : "";
    if (adminId && chatId !== adminId) {
         console.log(`Blocked access from ${chatId}`);
         return new Response('OK');
    }

    if (command === '/start' || command === '/help') {
         await sendTgMessage(token, chatId, 
            "🤖 <b>Admin Console</b>\n\n" +
            "/stats - User statistics\n" +
            "/search <phone> - Find user\n" +
            "/addpoints <phone> <amount> - Add points"
         );
    } else if (command === '/stats') {
         if (env.DB) {
             const res: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
             const tables: any = await env.DB.prepare("SELECT count(*) as c FROM game_tables").first();
             await sendTgMessage(token, chatId, `📊 <b>Stats</b>\nUsers: ${res?.c || 0}\nTables: ${tables?.c || 0}`);
         } else {
             await sendTgMessage(token, chatId, "⚠️ DB Missing");
         }
    } else if (command === '/search') {
         if (!args[0]) await sendTgMessage(token, chatId, "Usage: /search <phone>");
         else {
             const user: any = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(args[0]).first();
             if (user) await sendTgMessage(token, chatId, `👤 ${user.nickname}\n💰 ${user.points}\nID: ${user.id}`);
             else await sendTgMessage(token, chatId, "User not found.");
         }
    } else if (command === '/addpoints') {
         if (args.length < 2) await sendTgMessage(token, chatId, "Usage: /addpoints <phone> <amount>");
         else {
             await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(parseInt(args[1]), args[0]).run();
             await sendTgMessage(token, chatId, `✅ Added ${args[1]} points to ${args[0]}`);
         }
    }

    return new Response('OK');

  } catch (e: any) {
    console.error("Handler Error:", e);
    return new Response('Error handled', { status: 200 });
  }
};
