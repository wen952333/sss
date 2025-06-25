const backend = "https://9526.ip-ddns.com/api.php";

export async function apiRequest(action, data) {
  const res = await fetch(backend, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // 必须，带上cookie用于session校验
    body: JSON.stringify({ action, ...data }),
  });
  return await res.json();
}

export async function whoami() {
  return await apiRequest("whoami", {});
}
