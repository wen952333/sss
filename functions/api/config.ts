
type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) => Promise<Response>;

interface Env {
  DB: {
    prepare: (q: string) => { first: (col?: string) => Promise<any> };
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  let botUsername = "geminidoudizhubot"; // 兜底默认值
  let appShortName = "app";

  try {
    const res: any = await context.env.DB.prepare("SELECT value FROM settings WHERE key = 'bot_username'").first();
    if (res && res.value) {
      botUsername = res.value;
    }
    const resShort: any = await context.env.DB.prepare("SELECT value FROM settings WHERE key = 'app_short_name'").first();
    if (resShort && resShort.value) {
      appShortName = resShort.value;
    }
  } catch (e) {}

  return new Response(JSON.stringify({
    botUsername,
    appShortName
  }), {
    headers: { "Content-Type": "application/json" }
  });
};
