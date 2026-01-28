
type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
}) => Promise<Response>;

interface Env {
  DB: {
    prepare: (q: string) => { bind: (...args: any[]) => { run: () => Promise<any> } };
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { bot_username, app_short_name } = await context.request.json() as any;
    
    await context.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('bot_username', ?)")
      .bind(bot_username).run();
      
    await context.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_short_name', ?)")
      .bind(app_short_name).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
