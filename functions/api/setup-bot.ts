
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const token = env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN.trim() : "";

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing TELEGRAM_BOT_TOKEN" }), { status: 500 });
  }

  // 获取当前部署的域名
  const urlObj = new URL(request.url);
  const domain = urlObj.origin;
  const webhookUrl = `${domain}/api/webhook`;

  // 1. 设置 Webhook
  const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  
  // 2. 设置左下角命令菜单
  const setCommandsUrl = `https://api.telegram.org/bot${token}/setMyCommands`;
  const commandsPayload = {
    commands: [
      { command: "start", description: "🎮 开始游戏 / 打开主菜单" },
      { command: "balance", description: "💰 查询我的积分" },
      { command: "checkin", description: "📅 每日签到 (Bot版)" },
      { command: "help", description: "❓ 获取帮助" }
    ]
  };

  try {
    // 执行 Webhook 设置
    const webhookResp = await fetch(setWebhookUrl);
    const webhookData = await webhookResp.json();

    // 执行菜单设置
    const commandsResp = await fetch(setCommandsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commandsPayload)
    });
    const commandsData = await commandsResp.json();

    return new Response(JSON.stringify({
      status: "Setup Completed",
      domain: domain,
      webhook_target: webhookUrl,
      webhook_result: webhookData,
      commands_result: commandsData,
      instruction: "如果 webhook_result 为 true，请返回 Telegram 向 Bot 发送 /start 测试。"
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
