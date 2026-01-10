interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean }>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ success: boolean; results?: T[] }[]>;
}
type PagesFunction<Env = unknown> = (context: { request: Request; env: Env; }) => Promise<Response>;

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  try {
    const { fromId, toId, amount } = await context.request.json() as any;
    const numAmount = parseInt(amount);

    if (numAmount <= 0) return new Response(JSON.stringify({ error: "金额必须大于0" }), { status: 400 });
    if (fromId === toId) return new Response(JSON.stringify({ error: "不能转账给自己" }), { status: 400 });

    const sender = await db.prepare('SELECT points FROM Users WHERE id = ?').bind(fromId).first<{ points: number }>();
    if (!sender || sender.points < numAmount) {
        return new Response(JSON.stringify({ error: "余额不足" }), { status: 400 });
    }

    await db.batch([
        db.prepare('UPDATE Users SET points = points - ? WHERE id = ?').bind(numAmount, fromId),
        db.prepare('UPDATE Users SET points = points + ? WHERE id = ?').bind(numAmount, toId),
        db.prepare('INSERT INTO Transactions (from_user_id, to_user_id, amount, note) VALUES (?, ?, ?, ?)')
          .bind(fromId, toId, numAmount, 'User Transfer')
    ]);

    const newSender = await db.prepare('SELECT points FROM Users WHERE id = ?').bind(fromId).first<{ points: number }>();

    return new Response(JSON.stringify({ success: true, newPoints: newSender?.points }), { 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "转账失败: " + e.message }), { status: 500 });
  }
};