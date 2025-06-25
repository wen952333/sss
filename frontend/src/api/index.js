const API_BASE = "https://9526.ip-ddns.com/api";

export async function apiPost(endpoint, data) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function apiGet(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  const res = await fetch(url, { credentials: "include" });
  return await res.json();
}
