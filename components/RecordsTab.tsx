"use client";
import { useState } from "react";
import { RECORD_TYPES, type ServiceRecord } from "../lib/types";
import { daysLeft, dueLabel, pendingVisitRecord, todayStr } from "../lib/utils";
import { api } from "../lib/api";

const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";
const ICON: Record<string, string> = { 방문: "🚗", 방문예약: "📅", 필터교체: "🔧", AS: "🛠", 상담: "💬", 민원: "⚠️", 특이사항: "📌" };

export type VisitAct = (customerId: string, act: { type: "done" } | { type: "cancel" }) => Promise<void>;

export default function RecordsTab({
  customerId, records, notify, onSaved, onRemoved, onVisit,
}: {
  customerId: string; records: ServiceRecord[]; notify: (m: string) => void;
  onSaved: (saved: ServiceRecord, old?: ServiceRecord) => Promise<void>;
  onRemoved: (old: ServiceRecord) => Promise<void>; onVisit: VisitAct;
}) {
  const [form, setForm] = useState<Partial<ServiceRecord> | null>(null);
  const [saving, setSaving] = useState(false);
  const [ftype, setFtype] = useState("all");
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const typeCount = new Map<string, number>();
  records.forEach((r) => typeCount.set(r.type, (typeCount.get(r.type) ?? 0) + 1));
  const visible = ftype === "all" ? sorted : sorted.filter((r) => r.type === ftype);
  const visitRec = pendingVisitRecord(records);
  const visit = visitRec?.nextVisit ?? null;
  const [vbusy, setVbusy] = useState(false);
  const act = async (a: Parameters<VisitAct>[1]) => { setVbusy(true); try { await onVisit(customerId, a); } finally { setVbusy(false); } };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.type === "방문예약" && !form.nextVisit) return notify("방문 예정일을 입력해 주세요.");
    if (!form.content?.trim() && !form.nextVisit) return notify("내용을 입력해 주세요.");
    setSaving(true);
    try {
      const old = form.id ? records.find((r) => r.id === form.id) : undefined;
      const body = old && form.nextVisit !== old.nextVisit ? { ...form, visitClosed: false } : form; // 예정일을 바꾸면 다시 "예정"으로
      const saved: ServiceRecord = form.id
        ? await api(`/api/records/${form.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await api("/api/records", { method: "POST", body: JSON.stringify({ ...form, customerId }) });
      await onSaved(saved, old);
      notify("기록되었습니다."); setForm(null);
    } catch (err) { notify((err as Error).message); } finally { setSaving(false); }
  }
  async function del(r: ServiceRecord) {
    if (!confirm(r.type === "필터교체" ? "이 기록을 삭제할까요?\n필터 교환일도 이전 기록 기준으로 되돌아갑니다." : "이 기록을 삭제할까요?")) return;
    try { await api(`/api/records/${r.id}`, { method: "DELETE" }); await onRemoved(r); notify("삭제되었습니다."); } catch (err) { notify((err as Error).message); }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-100 p-4">
        {visit && (
          <div className={`space-y-2 rounded-xl p-3 ring-1 ${daysLeft(visit) < 0 ? "bg-red-50 ring-red-200" : "bg-violet-50 ring-violet-200"}`}>
            <div className={`text-sm font-semibold ${daysLeft(visit) < 0 ? "text-red-700" : "text-violet-700"}`}>
              📅 다음 방문 예정 {visit} · {dueLabel(daysLeft(visit))}
            </div>
            <div className="flex gap-2">
              <button disabled={vbusy} onClick={() => act({ type: "done" })} className="flex-[2] rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-60">✅ 완료 처리</button>
              <button disabled={vbusy} onClick={() => confirm("방문 예정을 취소할까요?") && act({ type: "cancel" })} className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-500 disabled:opacity-60">✖ 취소</button>
            </div>
          </div>
        )}
        {form && (
          <form onSubmit={save} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-2 ring-sky-300">
            <div className="flex flex-wrap gap-1.5">
              {RECORD_TYPES.filter((t) => t !== "방문" || form.type === "방문").map((t) => ( // 새 이력에서는 "방문"을 고르지 않음 (기존 방문 이력 수정 시에만 표시)
                <button type="button" key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${form.type === t ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>{ICON[t]} {t}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs text-slate-500">날짜</span>
                <input className={inp} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              {(form.type === "방문예약" || form.nextVisit) && (
                <label className="block"><span className="mb-1 block text-xs text-slate-500">방문 예정일{form.type === "방문예약" ? "" : " (선택)"}</span>
                  <input className={inp} type="date" value={form.nextVisit ?? ""} onChange={(e) => setForm({ ...form, nextVisit: e.target.value })} /></label>
              )}
              <label className="block min-[400px]:col-span-2"><span className="mb-1 block text-xs text-slate-500">내용{form.type === "특이사항" && !form.id ? " (고객 메모에도 함께 저장됩니다)" : ""}</span>
                <textarea className={inp} rows={3} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={form.type === "방문예약" ? "예) 전화 통화, 목요일 저녁 6시 가능" : "예) 세디·카본 교체, 다음엔 오후 방문 요청"} /></label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 font-medium text-slate-600">취소</button>
              <button disabled={saving} className="flex-[2] rounded-xl bg-sky-700 py-2.5 font-semibold text-white disabled:opacity-60">{form.id ? "수정 저장" : "기록하기"}</button>
            </div>
          </form>
        )}
        {records.length > 0 && !form && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[["all", `전체 ${records.length}`], ...RECORD_TYPES.filter((t) => typeCount.has(t)).map((t) => [t, `${ICON[t]} ${t} ${typeCount.get(t)}`])].map(([k, l]) => (
              <button key={k} onClick={() => setFtype(k)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${ftype === k ? "bg-sky-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{l}</button>
            ))}
          </div>
        )}
        {records.length === 0 && !form && <p className="py-10 text-center text-sm text-slate-400">방문·상담 이력이 없습니다.</p>}
        {records.length > 0 && visible.length === 0 && !form && <p className="py-6 text-center text-sm text-slate-400">이 종류의 기록이 없습니다.</p>}
        <ol className="space-y-2">
          {visible.map((r) => (
            <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-2 text-sm">
                <span>{ICON[r.type]}</span><span className="font-semibold">{r.type}</span>
                <span className="text-[13px] text-slate-400">{r.date}</span>
                <span className="ml-auto flex">
                  <button onClick={() => setForm(r)} className="rounded px-2 py-1 text-sm text-sky-700">수정</button>
                  <button onClick={() => del(r)} className="rounded px-2 py-1 text-sm text-red-600">삭제</button>
                </span>
              </div>
              {r.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{r.content}</p>}
              {r.nextVisit && r !== visitRec && <p className="mt-1 text-xs text-slate-400">↳ 방문 예정 {r.nextVisit} · 처리됨</p>}
              {r.nextVisit && r === visitRec && <p className="mt-1 text-xs font-medium text-violet-600">↑ 위 예정 카드에서 관리</p>}
            </li>
          ))}
        </ol>
      </div>
      {!form && (
        <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          <div className="flex gap-3">
            <button onClick={() => setForm({ date: todayStr(), type: "방문예약", content: "", nextVisit: "" })} className="flex-1 rounded-2xl border border-violet-300 bg-violet-50 py-3.5 font-semibold text-violet-700 active:bg-violet-100">📅 방문 예약</button>
            <button onClick={() => setForm({ date: todayStr(), type: "특이사항", content: "", nextVisit: "" })} className="flex-[1.4] rounded-2xl bg-sky-700 py-3.5 font-semibold text-white active:bg-sky-800">+ 이력 · 특이사항</button>
          </div>
        </div>
      )}
    </div>
  );
}
