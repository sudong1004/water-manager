export const SUPABASE_URL = process.env.NEXT_SUPABASE_URL ?? "";
// 새 Supabase 대시보드는 PUBLISHABLE_KEY, 예전 이름은 ANON_KEY — 둘 다 지원
export const SUPABASE_KEY =
  process.env.NEXT_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_SUPABASE_ANON_KEY ??
  "";
/** 환경변수가 설정되어 있으면 Supabase(로그인+DB), 없으면 로컬 파일 모드 */
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
