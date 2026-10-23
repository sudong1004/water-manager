"use client";
import { useState } from "react";
import type { Payment } from "../lib/types";
import { balanceOf, sumBy, todayStr, won } from "../lib/utils";
import { api } from "../lib/api";

const METHODS = ["CMS", "카드", "현금", "계좌이체", "기타"];
const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";

export default function PaymentsTab({
  customerId, monthlyFee, payments, onSaved, onRemoved, notify,
}: { customerId: string; monthlyFee: number; payments: Payment[]; onSaved: (p: Payment) => void; onRemoved: (id: string) => void; notify: (m: string) => void }) {
  const blank = (): Partial<Payment> => ({ date: todayStr(), kind: "수납", amount: monthlyFee || 0, method: "CMS", memo: "" });
  const [form, setForm] = useState<Partial<Payment> | null>(null);
  const [saving, setSaving] = useState(false);
  const sorted = [...payments].sort((a, b) => b.date.localeCompare(a.date));
  const bal = balanceOf(payments);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const saved: Payment = form.id
        ? await api(`/api/payments/${form.id}`, { method: "PUT", body: JSON.stringify(form) })
        : await api("/api/payments", { method: "POST", body: JSON.stringify({ ...form, customerId }) });
      onSaved(saved); notify(form.id ? "수정되었습니다." : form.kind === "수납" ? "수납이 기록되었습니다." : "청구가 기록되었습니다.");
      setForm(null);
    } catch (err) { notify((err as Error).message); } finally { setSaving(false); }
  }
  async function del(p: Payment) {
    if (!confirm(`${p.date} ${p.kind} ${won(p.amount)} 기록을 삭제할까요?`)) return;
    try { await api(`/api/payments/${p.id}`, { method: "DELETE" }); onRemoved(p.id); notify("삭제되었습니다."); } catch (err) { notify((err as Error).message); }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-100 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["수납 합계", won(sumBy(payments, "수납")), "text-emerald-600"], ["청구 합계", won(sumBy(payments, "청구")), "text-slate-800"], ["미수금", won(bal), bal ? "text-red-600" : "text-slate-400"]].map(([l, v, t]) => (
            <div key={l} className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
              <div className="text-[11px] text-slate-500">{l}</div>
              <div className={`text-sm font-bold ${t}`}>{v}</div>
            </div>
          ))}
        </div>

        {form && (
          <form onSubmit={save} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-2 ring-sky-300">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {(["수납", "청구"] as const).map((k) => (
                <button type="button" key={k} onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-md py-2 text-sm font-semibold ${form.kind === k ? "bg-white text-sky-700 shadow" : "text-slate-500"}`}>
                  {k === "수납" ? "💰 수납(받은 돈)" : "🧾 청구(받을 돈)"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs text-slate-500">날짜</span>
                <input className={inp} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">금액(원)</span>
                <input className={inp} type="number" inputMode="numeric" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">수단</span>
                <select className={inp} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {Array.from(new Set([...METHODS, form.method ?? ""])).filter(Boolean).map((m) => <option key={m}>{m}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">메모</span>
                <input className={inp} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="예) 10월분" /></label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 font-medium text-slate-600">취소</button>
              <button disabled={saving} className="flex-[2] rounded-xl bg-sky-700 py-2.5 font-semibold text-white disabled:opacity-60">{form.id ? "수정 저장" : "기록하기"}</button>
            </div>
          </form>
        )}

        {sorted.length === 0 && !form && <p className="py-10 text-center text-sm text-slate-400">수납·청구 기록이 없습니다.</p>}
        <ul className="space-y-2">
          {sorted.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${p.kind === "수납" ? "bg-emerald-50" : "bg-amber-50"}`}>{p.kind === "수납" ? "💰" : "🧾"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`font-bold ${p.kind === "수납" ? "text-emerald-600" : "text-amber-700"}`}>{p.kind === "수납" ? "+" : ""}{won(p.amount)}</span>
                  <span className="text-[13px] text-slate-500">{p.kind} · {p.method}</span>
                </div>
                <div className="truncate text-[13px] text-slate-400">{p.date}{p.memo && ` · ${p.memo}`}</div>
              </div>
              <button onClick={() => setForm(p)} className="rounded-lg px-2 py-1.5 text-sm text-sky-700 active:bg-sky-50">수정</button>
              <button onClick={() => del(p)} className="rounded-lg px-2 py-1.5 text-sm text-red-600 active:bg-red-50">삭제</button>
            </li>
          ))}
        </ul>
      </div>
      {!form && (
        <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          <button onClick={() => setForm(blank())} className="w-full rounded-2xl bg-sky-700 py-3.5 font-semibold text-white active:bg-sky-800">+ 수납 / 청구 기록</button>
        </div>
      )}
    </div>
  );
}
