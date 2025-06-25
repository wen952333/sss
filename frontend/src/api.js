const backend = "https://9526.ip-ddns.com/api.php";

export async function apiRequest(action, data) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(backend, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...data }),
  });
  return await res.json();
}

export async function whoami() {
  return await apiRequest("whoami", {});
}
