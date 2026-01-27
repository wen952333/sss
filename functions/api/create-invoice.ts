
// Define PagesFunction type locally since @cloudflare/workers-types might be missing
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
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { TELEGRAM_BOT_TOKEN } = context.env;

    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(JSON.stringify({ error: "Server missing TELEGRAM_BOT_TOKEN" }), { status: 500 });
    }

    // 解析请求体 (前端传来的商品信息，这里简化为固定)
    // const body = await context.request.json() as any;
    
    // 构造请求调用 Telegram Bot API
    // 文档: https://core.telegram.org/bots/api#createinvoicelink
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createInvoiceLink`;

    const payload = {
      title: "2000 游戏积分",
      description: "购买积分用于斗地主游戏",
      payload: "{\"product\": \"points_2000\", \"timestamp\": " + Date.now() + "}", // 开发者内部透传字段
      provider_token: "", // ★关键★：Telegram Stars 支付此字段必须为空字符串
      currency: "XTR",    // ★关键★：Telegram Stars 的货币代码必须是 XTR
      prices: [
        { label: "2000 积分", amount: 1 } // amount: 1 代表 1 颗星星
      ]
    };

    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json();

    if (!data.ok) {
      return new Response(JSON.stringify({ error: "Telegram API Error", details: data }), { status: 500 });
    }

    // 返回生成的支付链接
    return new Response(JSON.stringify({ invoiceLink: data.result }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
