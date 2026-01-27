
type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) => Promise<Response>;

interface Env {
  VITE_BOT_USERNAME?: string;
  VITE_APP_SHORT_NAME?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return new Response(JSON.stringify({
    botUsername: context.env.VITE_BOT_USERNAME || "geminidoudizhubot",
    appShortName: context.env.VITE_APP_SHORT_NAME || "app"
  }), {
    headers: { "Content-Type": "application/json" }
  });
};
