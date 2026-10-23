"use client";
import { useEffect, useState } from "react";
import type { Customer, ImportLog } from "../lib/types";
import { api } from "../lib/api";

type Item = { status: "new" | "update" | "same"; id: string; name: string; changes: string[]; customer: Customer };
type Preview = { fileName: string; items: Item[]; errors: { row: number; message: string }[]; summary: { new: number; update: number; same: number; errors: number } };

const badge = { new: ["신규", "bg-emerald-100 text-emerald-700"], update: ["변경", "bg-amber-100 text-amber-800"], same: ["동일", "bg-slate-100 text-slate-500"] } as const;

export default function ImportView({ reload, notify }: { reload: () => Promise<void>; notify: (m: string) => void }) {
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [show, setShow] = useState<"all" | "new" | "update" | "same">("all");
  const loadLogs = () => api("/api/imports").then(setLogs).catch(() => {});
  useEffect(() => { loadLogs(); }, []);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr(""); setPv(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      setPv(await api("/api/import", { method: "POST", body: fd }));
      setShow("all");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function apply() {
    if (!pv) return;
    setBusy(true);
    try {
      const log: ImportLog = await api("/api/import/apply", { method: "POST", body: JSON.stringify({ fileName: pv.fileName, errors: pv.summary.errors, unchanged: pv.summary.same, items: pv.items.filter((x) => x.status !== "same") }) });
      notify(`반영 완료: 신규 ${log.added}, 변경 ${log.updated}`);
      setPv(null); await reload(); await loadLogs();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const todo = pv ? pv.summary.new + pv.summary.update : 0;
  const items = pv?.items.filter((i) => show === "all" || i.status === show) ?? [];

  return (
    <div className="space-y-4 px-4 pt-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-sky-800">월별 엑셀 가져오기</h2>
        <p className="mt-1 text-sm text-slate-500">기존 프로그램에서 받은 .xls / .xlsx 파일을 올리면 <b>관리번호</b>로 기존 고객과 비교합니다. 반영 전에 미리보기로 확인하고, 직접 기록한 <b>수납·이력·특이사항은 그대로 유지</b>됩니다.</p>
        <label className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 py-8 text-sky-700 active:bg-sky-100">
          <span className="text-3xl">📄</span><span className="mt-1 font-semibold">{busy ? "처리 중…" : "엑셀 파일 선택"}</span>
          <input type="file" accept=".xls,.xlsx" className="hidden" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      </section>

      {pv && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-2 ring-sky-300">
          <h2 className="truncate text-sm font-bold">미리보기 · {pv.fileName}</h2>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {([["new", "신규", "text-emerald-600"], ["update", "변경", "text-amber-600"], ["same", "동일", "text-slate-400"]] as const).map(([k, l, t]) => (
              <button key={k} onClick={() => setShow(show === k ? "all" : k)} className={`rounded-lg bg-slate-50 p-2 ${show === k ? "ring-2 ring-sky-500" : ""}`}>
                <div className={`text-xl font-bold ${t}`}>{pv.summary[k]}</div><div className="text-xs text-slate-500">{l}</div></button>
            ))}
            <div className="rounded-lg bg-slate-50 p-2"><div className={`text-xl font-bold ${pv.summary.errors ? "text-red-600" : "text-slate-400"}`}>{pv.summary.errors}</div><div className="text-xs text-slate-500">오류</div></div>
          </div>
          {pv.errors.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">{pv.errors.map((e, i) => <li key={i}>• {e.row}행: {e.message}</li>)}</ul>
          )}
          <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge[i.status][1]}`}>{badge[i.status][0]}</span>
                <span className="min-w-0 flex-1 truncate">{i.name} <span className="text-xs text-slate-400">No.{i.id}</span></span>
                {i.changes.length > 0 && <span className="max-w-[45%] truncate text-xs text-slate-500">{i.changes.join(", ")}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setPv(null)} className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-600">취소</button>
            <button onClick={apply} disabled={busy || todo === 0} className="flex-[2] rounded-xl bg-sky-700 py-3 font-semibold text-white disabled:opacity-50">
              {todo === 0 ? "반영할 변경 없음" : `신규 ${pv.summary.new} · 변경 ${pv.summary.update}건 반영`}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 text-sm font-bold text-sky-800">가져오기 기록</h2>
        {logs.length === 0 ? <p className="py-3 text-center text-sm text-slate-400">아직 기록이 없습니다.</p> : (
          <ul className="divide-y divide-slate-100">{logs.map((l) => (
            <li key={l.id} className="py-2 text-sm">
              <div className="flex justify-between gap-2"><span className="truncate font-medium">{l.fileName}</span><span className="shrink-0 text-xs text-slate-400">{new Date(l.at).toLocaleString("ko-KR")}</span></div>
              <div className="text-xs text-slate-500">신규 {l.added} · 변경 {l.updated} · 동일 {l.unchanged} · 오류 {l.errors}</div>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
