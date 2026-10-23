import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, USE_SUPABASE } from "./lib/supabase/env";

export async function middleware(req: NextRequest) {
  if (!USE_SUPABASE) {
    // 로컬 파일 모드: 로그인이 없으므로 같은 네트워크(사설 IP/localhost)가 아닌 접속은 막는다
    const host = req.headers.get("host")?.replace(/:\d+$/, "") ?? "";
    const local = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host);
    if (!local) return new NextResponse("로컬 모드는 외부 주소로 접속할 수 없습니다.", { status: 403 });
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // 토큰 검증 + 갱신. getClaims는 서명 키가 비대칭이면 서버 왕복 없이 로컬에서 검증한다
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = req.nextUrl.pathname;
  if (!user && path !== "/login") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)"] };
