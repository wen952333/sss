const API_BASE = "https://9526.ip-ddns.com/api";

export async function apiPost(endpoint, data) {
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch(e) {
    return { ok: false, error: "服务器返回异常（不是有效JSON），请联系管理员。" };
  }
}

export async function apiGet(endpoint, params = {}) {
  try {
    const url = new URL(`${API_BASE}/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    const res = await fetch(url, { credentials: "include" });
    return await res.json();
  } catch(e) {
    return { ok: false, error: "服务器返回异常（不是有效JSON），请联系管理员。" };
  }
}
