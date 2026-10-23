"use client";
import { useMemo, useState } from "react";
import type { Customer, ServiceRecord } from "../lib/types";
import { findIssues, ISSUE_LABEL, type IssueKind } from "../lib/check";
import { backfillMemos } from "../lib/memo";
import { api } from "../lib/api";

export default function CheckView({ customers, records, open, reload, notify }: { customers: Customer[]; records: ServiceRecord[]; open: (id: string) => void; reload: () => Promise<void>; notify: (m: string) => void }) {
  const issues = useMemo(() => findIssues(customers, records), [customers, records]);
  const pendingMemo = useMemo(() => backfillMemos(customers, records), [customers, records]);
  const [busy, setBusy] = useState(false);
  async function moveMemos() {
    if (!confirm(`예전 특이사항 이력 ${pendingMemo.added}건을 고객 ${pendingMemo.changed.length}명의 메모 맨 아래에 추가할까요?\n(이력은 그대로 남고, 이미 메모에 있는 줄은 건너뜁니다)`)) return;
    setBusy(true);
    try { await api("/api/customers/memo-backfill", { method: "POST" }); await reload(); notify("특이사항을 메모에 추가했습니다."); } catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  }
  const [kind, setKind] = useState<IssueKind | "all">("all");
  const kinds = Object.keys(ISSUE_LABEL) as IssueKind[];
  const count = (k: IssueKind) => issues.filter((i) => i.kind === k).length;
  const shown = kind === "all" ? issues : issues.filter((i) => i.kind === kind);

  return (
    <div className="space-y-3 px-4 pt-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-sky-800">🔍 데이터 점검</h2>
        <p className="mt-1 text-sm text-slate-500">확인이 필요한 의심 사례를 모았습니다. 이 화면은 보기만 하며 데이터를 바꾸지 않습니다. 고객을 눌러 직접 확인하고 고치세요.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => setKind("all")} className={`rounded-full px-3 py-1.5 text-sm font-medium ${kind === "all" ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>전체 {issues.length}</button>
          {kinds.map((k) => (
            <button key={k} onClick={() => setKind(kind === k ? "all" : k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>{ISSUE_LABEL[k].icon} {ISSUE_LABEL[k].title} {count(k)}</button>
          ))}
        </div>
        {kind !== "all" && <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">{ISSUE_LABEL[kind].hint}</p>}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-sky-800">📝 예전 특이사항을 메모로 옮기기</h2>
        <p className="mt-1 text-sm text-slate-500">이력에 적어 둔 특이사항을 고객 메모(메모사항) 맨 아래에 <b>[날짜] 내용</b> 형태로 추가합니다. 이력은 지우지 않고, 이미 메모에 있는 줄은 건너뛰어서 여러 번 눌러도 중복되지 않습니다.</p>
        {pendingMemo.added === 0 ? <p className="mt-2 text-sm text-emerald-700">옮길 항목이 없습니다. ✅</p> : (
          <button disabled={busy} onClick={moveMemos} className="mt-3 w-full rounded-xl bg-sky-700 py-3 font-semibold text-white active:bg-sky-800 disabled:opacity-60">{busy ? "처리 중…" : `메모에 추가 (${pendingMemo.changed.length}명 · ${pendingMemo.added}건)`}</button>
        )}
      </section>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">점검할 항목이 없습니다. 👍</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((i, n) => (
            <li key={i.customerId + i.kind + n}>
              <button onClick={() => open(i.customerId)} className="flex w-full items-start gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 active:bg-slate-50">
                <span className="text-lg">{ISSUE_LABEL[i.kind].icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.name} <span className="text-xs text-slate-400">#{i.customerId}</span></span>
                  <span className="block text-xs text-slate-500">{ISSUE_LABEL[i.kind].title} · {i.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
