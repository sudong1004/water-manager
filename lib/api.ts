export async function api(url: string, init?: RequestInit) {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, { ...init, headers: isForm ? undefined : { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}
