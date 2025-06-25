const API_BASE = "https://9526.ip-ddns.com/api.php"; // 注意结尾必须是 /api.php

export async function apiRequest(action, data = {}) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({ action, ...data })
  });
  return res.json();
}
