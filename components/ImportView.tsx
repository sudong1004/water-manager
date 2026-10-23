"use client";
import { useEffect, useState } from "react";
import type { Customer, ImportLog } from "../lib/types";
import { api } from "../lib/api";
import type { Part } from "../lib/restore";

type RestorePreview = { fileName: string; data: unknown; customers: Part & { onlyCurrent: number }; payments: Part & { onlyCurrent: number }; records: Part & { onlyCurrent: number } };

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

  const [rp, setRp] = useState<RestorePreview | null>(null);
  const [rErr, setRErr] = useState("");
  async function onBackupFile(f: File | undefined) {
    if (!f) return;
    setBusy(true); setRErr(""); setRp(null);
    try {
      let data: unknown;
      try { data = JSON.parse(await f.text()); } catch { throw new Error("JSON 파일을 읽을 수 없습니다. 이 앱에서 받은 .json 백업 파일을 선택해 주세요."); }
      const r = await api("/api/restore", { method: "POST", body: JSON.stringify({ data, apply: false }) });
      setRp({ fileName: f.name, data, customers: r.customers, payments: r.payments, records: r.records });
    } catch (e) { setRErr((e as Error).message); } finally { setBusy(false); }
  }
  async function applyRestore() {
    if (!rp) return;
    const n = rp.customers.new + rp.customers.changed + rp.payments.new + rp.payments.changed + rp.records.new + rp.records.changed;
    if (!confirm(`백업 파일 내용으로 ${n}건을 복원합니다.\n(같은 항목은 파일 내용으로 덮어쓰고, 현재에만 있는 데이터는 그대로 둡니다)\n\n복원 전 현재 상태를 백업해 두셨나요?`)) return;
    setBusy(true); setRErr("");
    try {
      await api("/api/restore", { method: "POST", body: JSON.stringify({ data: rp.data, apply: true, fileName: rp.fileName }) });
      notify(`복원 완료: ${n}건`); setRp(null); await reload(); await loadLogs();
    } catch (e) { setRErr((e as Error).message); } finally { setBusy(false); }
  }
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  useEffect(() => { try { setLastBackup(localStorage.getItem("lastBackup")); } catch { /* 저장소 사용 불가 */ } }, []);
  function markBackup() { const d = new Date().toISOString().slice(0, 10); try { localStorage.setItem("lastBackup", d); } catch { /* 무시 */ } setLastBackup(d); }
  const backupAge = lastBackup ? Math.round((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;

  return (
    <div className="space-y-4 px-4 pt-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-sky-800">💾 전체 백업</h2>
        <p className="mt-1 text-sm text-slate-500">고객·수납·이력 전체를 파일로 받아 둡니다. 실수로 지우거나 문제가 생길 때를 대비해 <b>주기적으로(예: 매주)</b> 받아 두세요.</p>
        <p className={`mt-1 text-xs ${backupAge === null || backupAge > 14 ? "font-semibold text-red-600" : "text-slate-400"}`}>
          {lastBackup ? `마지막 백업: ${lastBackup} (${backupAge === 0 ? "오늘" : `${backupAge}일 전`})` : "이 기기에서 백업한 기록이 없습니다."}
        </p>
        <div className="mt-3 flex gap-3">
          <a href="/api/backup?format=json" download onClick={markBackup} className="flex-1 rounded-xl bg-sky-700 py-3 text-center font-semibold text-white active:bg-sky-800">백업 파일 (JSON)</a>
          <a href="/api/backup?format=xlsx" download onClick={markBackup} className="flex-1 rounded-xl border border-sky-300 bg-sky-50 py-3 text-center font-semibold text-sky-800 active:bg-sky-100">엑셀로 보기</a>
        </div>
        <p className="mt-2 text-xs text-slate-400">JSON은 모든 정보가 들어 있는 복구용, 엑셀은 열어서 보기용입니다.</p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-sky-800">♻️ 백업에서 복원</h2>
        <p className="mt-1 text-sm text-slate-500">위에서 받은 <b>JSON 백업 파일</b>로 지운 고객·기록을 되살립니다. 먼저 미리보기로 확인하며, 현재에만 있는 데이터는 지우지 않습니다. 복원 전에 <b>현재 상태 백업</b>을 먼저 받아 두세요.</p>
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-4 font-semibold text-slate-600 active:bg-slate-100">
          {busy ? "처리 중…" : "백업 파일(.json) 선택"}
          <input type="file" accept=".json,application/json" className="hidden" disabled={busy} onChange={(e) => { onBackupFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {rErr && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{rErr}</p>}
        {rp && (
          <div className="mt-3 space-y-2">
            <p className="truncate text-sm font-semibold">{rp.fileName}</p>
            <table className="w-full text-center text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="py-1 text-left font-medium"></th><th className="font-medium">신규</th><th className="font-medium">변경</th><th className="font-medium">동일</th><th className="font-medium">현재에만</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {([["고객", rp.customers], ["수납", rp.payments], ["이력", rp.records]] as const).map(([l, p]) => (
                  <tr key={l}><td className="py-1.5 text-left font-medium">{l}</td>
                    <td className={p.new ? "font-bold text-emerald-600" : "text-slate-400"}>{p.new}</td>
                    <td className={p.changed ? "font-bold text-amber-600" : "text-slate-400"}>{p.changed}</td>
                    <td className="text-slate-400">{p.same}</td><td className="text-slate-400">{p.onlyCurrent}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400">신규=현재에 없어서 되살림 · 변경=현재와 달라서 파일 내용으로 덮어씀 · 현재에만=파일에 없지만 그대로 둠</p>
            {(() => { const n = rp.customers.new + rp.customers.changed + rp.payments.new + rp.payments.changed + rp.records.new + rp.records.changed; return (
              <div className="flex gap-3">
                <button onClick={() => setRp(null)} disabled={busy} className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-600">취소</button>
                <button onClick={applyRestore} disabled={busy || n === 0} className="flex-[2] rounded-xl bg-sky-700 py-3 font-semibold text-white disabled:opacity-50">{n === 0 ? "복원할 변경 없음" : `${n}건 복원`}</button>
              </div>); })()}
          </div>
        )}
      </section>

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
