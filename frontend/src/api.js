// 统一封装 API 请求，所有 API 自动携带 session cookie
export async function apiRequest(action, data) {
  const res = await fetch("/api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ★★必须加，携带cookie
    body: JSON.stringify({ action, ...data }),
  });
  // 增加异常处理，防止非json报错
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: "服务器异常: " + text };
  }
}
