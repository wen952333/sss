const backend = "https://9526.ip-ddns.com/api.php";

export async function apiRequest(action, data) {
  const res = await fetch(backend, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // 关键！带上 cookie 以便 session 校验
    body: JSON.stringify({ action, ...data }),
  });
  return await res.json();
}

export async function whoami() {
  return await apiRequest("whoami", {});
}
