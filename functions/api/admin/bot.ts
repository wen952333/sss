
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
    if (!update.message || !update.message.text) {
      return new Response("OK");
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const args = text.split(' ');
    const command = args[0];

    const sendMessage = async (msg: string) => {
        const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: chatId, text: msg })
        });
    };

    if (command === '/search' || command === '/find') {
        const query = args[1];
        if (!query) { await sendMessage("用法: /search <手机号或昵称>"); return new Response("OK"); }
        
        let users = await env.DB.prepare('SELECT * FROM Users WHERE phone = ?').bind(query).all<{ id: number, nickname: string, phone: string, points: number }>();
        if (!users.results || users.results.length === 0) {
            users = await env.DB.prepare('SELECT * FROM Users WHERE nickname LIKE ?').bind(`%${query}%`).all();
        }

        if (!users.results || users.results.length === 0) {
            await sendMessage("未找到用户");
        } else {
            let msg = "搜索结果:\n";
            for (const u of users.results) {
                msg += `ID: ${u.id} | 昵称: ${u.nickname} | 手机: ${u.phone} | 积分: ${u.points}\n`;
            }
            await sendMessage(msg);
        }
    }
    
    else if (command === '/list') {
        const users = await env.DB.prepare('SELECT * FROM Users ORDER BY id DESC LIMIT 10').all<{ id: number, nickname: string, phone: string, points: number }>();
        let msg = "最新注册10位用户:\n";
        if(users.results) {
            for (const u of users.results) {
                msg += `ID: ${u.id} | ${u.nickname} | ${u.phone} | 💰${u.points}\n`;
            }
        }
        await sendMessage(msg);
    }

    else if (command === '/mod') {
        const id = args[1];
        const amount = parseInt(args[2]);
        if (!id || isNaN(amount)) { await sendMessage("用法: /mod <用户ID> <积分增减(正负)>"); return new Response("OK"); }

        await env.DB.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(amount, id).run();
        const u = await env.DB.prepare('SELECT nickname, points FROM Users WHERE id = ?').bind(id).first<{ nickname: string, points: number }>();
        if (u) {
            await sendMessage(`操作成功。用户 [${u.nickname}] 当前积分: ${u.points}`);
        } else {
            await sendMessage("用户ID不存在");
        }
    }

    else if (command === '/del') {
        const id = args[1];
        if (!id) { await sendMessage("用法: /del <用户ID>"); return new Response("OK"); }
        
        await env.DB.prepare('DELETE FROM Users WHERE id = ?').bind(id).run();
        await sendMessage(`用户 ID ${id} 已删除`);
    }

    else if (command === '/help' || command === '/start') {
        await sendMessage("十三水管理后台 Bot\n\n指令列表:\n/search <关键词> - 查找用户\n/list - 查看最新用户\n/mod <ID> <金额> - 增减积分\n/del <ID> - 删除用户");
    }

    return new Response("OK");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
