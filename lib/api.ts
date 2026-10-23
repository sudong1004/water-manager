/** fetch 래퍼: 응답이 없으면 끊고, 네트워크/세션 문제를 알아보기 쉬운 메시지로 바꿈 */
export async function api(url: string, init?: RequestInit) {
  const isForm = init?.body instanceof FormData;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), isForm ? 60_000 : 20_000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal, headers: isForm ? undefined : { "Content-Type": "application/json" } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("서버 응답이 없습니다. 네트워크를 확인하고, 저장 작업이었다면 목록에서 반영 여부를 확인해 주세요.");
    throw new Error("네트워크에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login"; // 세션 만료
    throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}
