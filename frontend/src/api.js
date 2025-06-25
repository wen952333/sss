const backend = 'https://9526.ip-ddns.com/api.php';

export async function apiRequest(action, data) {
  const res = await fetch(backend, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, ...data }),
  });
  return await res.json();
}
