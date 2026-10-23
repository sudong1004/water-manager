"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-bold text-slate-800">화면을 표시하는 중 문제가 생겼습니다.</p>
      <p className="break-all text-sm text-slate-500">{error.message}</p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-xl bg-sky-700 px-5 py-2.5 font-semibold text-white active:bg-sky-800">다시 시도</button>
        <button onClick={() => window.location.reload()} className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium text-slate-600">새로고침</button>
      </div>
    </div>
  );
}
