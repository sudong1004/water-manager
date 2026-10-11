"use client";
import { useState } from "react";
import { RECORD_TYPES, type ServiceRecord } from "../lib/types";
import { daysLeft, dueLabel, pendingVisit, todayStr } from "../lib/utils";
import { api } from "../lib/api";

const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";
const ICON: Record<string, string> = { 방문: "🚗", 필터교체: "🔧", AS: "🛠", 상담: "💬", 민원: "⚠️", 특이사항: "📌" };

export default function RecordsTab({
  customerId, records, reload, notify,
}: { customerId: string; records: ServiceRecord[]; reload: () => Promise<void>; notify: (m: string) => void }) {
  const [form, setForm] = useState<Partial<ServiceRecord> | null>(null);
  const [saving, setSaving] = useState(false);
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const visit = pendingVisit(records);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.content?.trim() && !form.nextVisit) return notify("내용을 입력해 주세요.");
    setSaving(true);
    try {
      if (form.id) await api(`/api/records/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      else await api("/api/records", { method: "POST", body: JSON.stringify({ ...form, customerId }) });
      await reload(); notify("기록되었습니다."); setForm(null);
    } catch (err) { notify((err as Error).message); } finally { setSaving(false); }
  }
  async function del(r: ServiceRecord) {
    if (!confirm("이 기록을 삭제할까요?")) return;
    await api(`/api/records/${r.id}`, { method: "DELETE" }); await reload(); notify("삭제되었습니다.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-100 p-4">
        {visit && (
          <div className="rounded-xl bg-violet-50 p-3 text-sm font-semibold text-violet-700 ring-1 ring-violet-200">
            📅 다음 방문 예정 {visit} · {dueLabel(daysLeft(visit))}
          </div>
        )}
        {form && (
          <form onSubmit={save} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-2 ring-sky-300">
            <div className="flex flex-wrap gap-1.5">
              {RECORD_TYPES.map((t) => (
                <button type="button" key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${form.type === t ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>{ICON[t]} {t}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs text-slate-500">날짜</span>
                <input className={inp} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">다음 방문 예정일 (선택)</span>
                <input className={inp} type="date" value={form.nextVisit ?? ""} onChange={(e) => setForm({ ...form, nextVisit: e.target.value })} /></label>
              <label className="col-span-2 block"><span className="mb-1 block text-xs text-slate-500">내용 · 특이사항</span>
                <textarea className={inp} rows={3} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="예) 세디·카본 교체, 다음엔 오후 방문 요청" /></label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 font-medium text-slate-600">취소</button>
              <button disabled={saving} className="flex-[2] rounded-xl bg-sky-700 py-2.5 font-semibold text-white disabled:opacity-60">{form.id ? "수정 저장" : "기록하기"}</button>
            </div>
          </form>
        )}
        {sorted.length === 0 && !form && <p className="py-10 text-center text-sm text-slate-400">방문·상담 이력이 없습니다.</p>}
        <ol className="space-y-2">
          {sorted.map((r) => (
            <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-2 text-sm">
                <span>{ICON[r.type]}</span><span className="font-semibold">{r.type}</span>
                <span className="text-xs text-slate-400">{r.date}</span>
                <span className="ml-auto flex">
                  <button onClick={() => setForm(r)} className="rounded px-2 py-1 text-sm text-sky-700">수정</button>
                  <button onClick={() => del(r)} className="rounded px-2 py-1 text-sm text-red-600">삭제</button>
                </span>
              </div>
              {r.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{r.content}</p>}
              {r.nextVisit && <p className="mt-1 text-xs font-medium text-violet-600">다음 방문 예정 {r.nextVisit}</p>}
            </li>
          ))}
        </ol>
      </div>
      {!form && (
        <div className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setForm({ date: todayStr(), type: "방문", content: "", nextVisit: "" })} className="w-full rounded-xl bg-sky-700 py-3 font-semibold text-white active:bg-sky-800">+ 이력 · 특이사항 기록</button>
        </div>
      )}
    </div>
  );
}
