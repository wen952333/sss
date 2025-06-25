// 统一封装 API 请求，所有 API 自动携带 session cookie
export async function apiRequest(action, data) {
  const res = await fetch("/backend/api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ★★必须加，携带cookie
    body: JSON.stringify({ action, ...data }),
  });
  return await res.json();
}
