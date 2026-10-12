"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "../../lib/supabase/client";
import { USE_SUPABASE } from "../../lib/supabase/env";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) {
      setErr(error.message.includes("Invalid login") ? "이메일 또는 비밀번호가 올바르지 않습니다." : error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (!USE_SUPABASE) {
    return <p className="p-10 text-center text-slate-500">로컬 모드에서는 로그인이 필요 없습니다. <a className="text-sky-700 underline" href="/">홈으로</a></p>;
  }
  const inp = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <div className="text-center">
          <div className="text-4xl">💧</div>
          <h1 className="mt-1 text-xl font-bold text-sky-800">정수기 고객관리</h1>
          <p className="mt-1 text-sm text-slate-500">관리자 계정으로 로그인하세요</p>
        </div>
        <input className={inp} type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inp} type="password" autoComplete="current-password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-sky-700 py-3 font-semibold text-white active:bg-sky-800 disabled:opacity-60">{busy ? "로그인 중…" : "로그인"}</button>
      </form>
    </main>
  );
}
