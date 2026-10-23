"use client";
import { useMemo, useState } from "react";
import type { Customer, ServiceRecord } from "../lib/types";
import { findIssues, ISSUE_LABEL, type IssueKind } from "../lib/check";

export default function CheckView({ customers, records, open }: { customers: Customer[]; records: ServiceRecord[]; open: (id: string) => void }) {
  const issues = useMemo(() => findIssues(customers, records), [customers, records]);
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
