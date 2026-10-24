"use client";
import { useState } from "react";
import type { Customer } from "../lib/types";

const daysAgo = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

export default function TrashView({ trash, onRestore, onPurge, notify }: {
  trash: Customer[]; onRestore: (c: Customer) => Promise<void>; onPurge: (c: Customer) => Promise<void>; notify: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const sorted = [...trash].sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  async function run(c: Customer, fn: (c: Customer) => Promise<void>) {
    setBusy(c.id);
    try { await fn(c); } catch (e) { notify((e as Error).message); } finally { setBusy(null); }
  }
  return (
    <div className="space-y-3 px-4 pt-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-sky-800">🗑 휴지통</h2>
        <p className="mt-1 text-sm text-slate-500">삭제한 고객이 여기에 보관됩니다. 수납·이력도 함께 보관되며 <b>복구</b>하면 그대로 돌아옵니다. 영구 삭제하면 수납·이력까지 모두 사라져 되돌릴 수 없습니다.</p>
      </section>
      {sorted.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">휴지통이 비어 있습니다.</p> : (
        <ul className="space-y-2">
          {sorted.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="truncate font-medium">{c.name} <span className="text-[13px] text-slate-400">No.{c.id}</span></div>
              <div className="text-[13px] text-slate-500">{daysAgo(c.deletedAt) === 0 ? "오늘" : `${daysAgo(c.deletedAt)}일 전`} 삭제{c.mobile1 ? ` · ${c.mobile1}` : ""}</div>
              <div className="mt-2 flex gap-3">
                <button disabled={busy === c.id} onClick={() => run(c, onRestore)} className="flex-[2] rounded-xl bg-sky-700 py-2.5 text-sm font-semibold text-white active:bg-sky-800 disabled:opacity-60">↩ 복구</button>
                <button disabled={busy === c.id} onClick={() => confirm(`"${c.name}" 고객을 영구 삭제할까요?\n수납·이력도 모두 사라지며 되돌릴 수 없습니다.`) && run(c, onPurge)}
                  className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 disabled:opacity-60">영구 삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
