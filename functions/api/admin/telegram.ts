
interface Env { DB: any; TG_BOT_TOKEN: string; ADMIN_CHAT_ID: string; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const token = env.TG_BOT_TOKEN ? env.TG_BOT_TOKEN.trim() : "";
    const adminId = env.ADMIN_CHAT_ID ? env.ADMIN_CHAT_ID.trim() : "";

    if (!token) return new Response("Missing TG_BOT_TOKEN", { status: 500 });

    const update = await request.json() as any;
    const message = update.message || update.edited_message;
    if (!message || !message.text) return new Response('OK');

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const command = text.split(' ')[0];
    const args = text.split(' ').slice(1);

    if (command === '/id') {
      await sendTgMessage(token, chatId, `🆔 Your ID: <code>${chatId}</code>`);
      return new Response('OK');
    }

    if (adminId && chatId !== adminId) {
      await sendTgMessage(token, chatId, "⛔ Not Admin");
      return new Response('OK');
    }

    let responseText = "";

    if (command === '/start') {
        responseText = `Bot Active. ID: ${chatId}`;
    } else if (command === '/stats') {
        if (!env.DB) { responseText = "DB Error"; }
        else {
             const userCount: any = await env.DB.prepare("SELECT count(*) as c FROM users").first();
             responseText = `Users: ${userCount?.c || 0}`;
        }
    } else if (command === '/addpoints') {
        if (!args[0] || !args[1]) responseText = "/addpoints <phone> <amount>";
        else {
            if (!env.DB) responseText = "DB Error";
            else {
                await env.DB.prepare("UPDATE users SET points = points + ? WHERE phone = ?").bind(parseInt(args[1]), args[0]).run();
                responseText = "Done";
            }
        }
    } else {
        responseText = "Unknown command";
    }

    await sendTgMessage(token, chatId, responseText);
    return new Response('OK');

  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};

async function sendTgMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}
