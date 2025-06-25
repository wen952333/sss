const API_BASE = "https://9526.ip-ddns.com/api.php"; // PHP后端入口

export async function apiRequest(action, data = {}) {
  // 统一POST请求
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({ action, ...data })
  });
  return res.json();
}
