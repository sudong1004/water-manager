"use client";
import { useState } from "react";
import type { Customer, Payment } from "../lib/types";
import { balanceOf, monthOf, regionOf, sumBy, thisMonth, won } from "../lib/utils";

export default function PaymentsView({ customers, payments, open }: { customers: Customer[]; payments: Payment[]; open: (id: string) => void }) {
  const [month, setMonth] = useState(thisMonth());
  const [tab, setTab] = useState<"month" | "debt">("month");
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? `(삭제된 고객 ${id})`;
  const list = payments.filter((p) => monthOf(p.date) === month).sort((a, b) => b.date.localeCompare(a.date));

  const by = new Map<string, Payment[]>();
  payments.forEach((p) => by.set(p.customerId, [...(by.get(p.customerId) ?? []), p]));
  const debtors = customers.map((c) => ({ c, bal: balanceOf(by.get(c.id) ?? []) })).filter((x) => x.bal > 0).sort((a, b) => b.bal - a.bal);

  return (
    <div className="px-4 pt-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1">
        {([["month", "월별 수납 내역"], ["debt", `미수금 (${debtors.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-2.5 text-sm font-semibold ${tab === k ? "bg-white text-sky-700 shadow" : "text-slate-500"}`}>{l}</button>
        ))}
      </div>

      {tab === "month" ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2" />
            <div className="ml-auto text-right text-sm">
              <div>수납 <b className="text-emerald-600">{won(sumBy(list, "수납"))}</b></div>
              <div className="text-xs text-slate-500">청구 {won(sumBy(list, "청구"))}</div>
            </div>
          </div>
          {list.length === 0 ? <p className="py-16 text-center text-slate-400">이 달의 기록이 없습니다.<br /><span className="text-xs">고객 상세 → 수납 탭에서 기록하세요.</span></p> : (
            <ul className="mt-3 space-y-2">{list.map((p) => (
              <li key={p.id}><button onClick={() => open(p.customerId)} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 active:bg-slate-50">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{name(p.customerId)}</div><div className="truncate text-xs text-slate-500">{p.date} · {p.kind} · {p.method}{p.memo && ` · ${p.memo}`}</div></div>
                <div className={`font-bold ${p.kind === "수납" ? "text-emerald-600" : "text-amber-700"}`}>{won(p.amount)}</div>
              </button></li>
            ))}</ul>
          )}
        </>
      ) : debtors.length === 0 ? (
        <p className="py-16 text-center text-slate-400">미수금이 있는 고객이 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">{debtors.map(({ c, bal }) => (
          <li key={c.id}><button onClick={() => open(c.id)} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 active:bg-slate-50">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{c.name}</div><div className="truncate text-xs text-slate-500">{regionOf(c).sigungu} {regionOf(c).dong} · {c.mobile1 || c.tel1}</div></div>
            <div className="font-bold text-red-600">{won(bal)}</div>
          </button></li>
        ))}</ul>
      )}
    </div>
  );
}
