"use client";
import { useState } from "react";
import type { Customer, Payment, ServiceRecord } from "../lib/types";
import { balanceOf, cycleLabel, daysLeft, dueDate, dueLabel, dueTone, fullAddr, pendingVisit, regionOf, todayStr, won } from "../lib/utils";
import PaymentsTab from "./PaymentsTab";
import RecordsTab from "./RecordsTab";

function Row({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === "" ) return null;
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-900">{value}</dd>
    </div>
  );
}

export default function CustomerDetail({
  c, payments, records, onEdit, onDelete, onReplace, onReplaceAll, reload, notify,
}: {
  c: Customer; payments: Payment[]; records: ServiceRecord[]; onEdit: () => void; onDelete: () => void;
  onReplace: (i: number) => void; onReplaceAll: () => void; reload: () => Promise<void>; notify: (m: string) => void;
}) {
  const [tab, setTab] = useState<"info" | "pay" | "rec">("info");
  const bal = balanceOf(payments);
  const visit = pendingVisit(records);
  const rg = regionOf(c);
  const phones = [c.mobile1, c.mobile2, c.tel1, c.tel2].filter(Boolean);
  const addr = fullAddr(c);
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-slate-200 bg-white">
        {([["info", "정보"], ["pay", `수납${bal ? " ●" : ""}`], ["rec", `이력 ${records.length}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 border-b-2 py-3 text-sm font-semibold ${tab === k ? "border-sky-700 text-sky-700" : "border-transparent text-slate-500"}`}>{l}</button>
        ))}
      </div>
      {tab === "pay" && <PaymentsTab customerId={c.id} monthlyFee={c.monthlyFee} payments={payments} reload={reload} notify={notify} />}
      {tab === "rec" && <RecordsTab customerId={c.id} records={records} reload={reload} notify={notify} />}
      {tab === "info" && (<>
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-100 p-4">
        {(bal > 0 || visit) && (
          <div className="flex flex-wrap gap-2">
            {bal > 0 && <button onClick={() => setTab("pay")} className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">미수금 {won(bal)}</button>}
            {visit && <button onClick={() => setTab("rec")} className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-semibold text-violet-700">방문 예정 {visit} ({dueLabel(daysLeft(visit))})</button>}
          </div>
        )}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex flex-wrap gap-2">
            {phones.map((p) => (
              <a key={p} href={`tel:${p.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white active:bg-sky-800">
                📞 {p}
              </a>
            ))}
            {phones.length > 0 && (
              <a href={`sms:${phones[0].replace(/[^\d+]/g, "")}`} className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 active:bg-slate-200">✉ 문자</a>
            )}
            {addr && (
              <a href={`https://map.naver.com/p/search/${encodeURIComponent(addr)}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 active:bg-emerald-100">🗺 지도</a>
            )}
          </div>
          <dl className="divide-y divide-slate-100">
            <Row label="관리번호" value={c.id} />
            <Row label="등록일자" value={c.regDate} />
            <Row label="고객정보" value={c.contactPerson} />
            <Row label="담당자" value={c.manager} />
            <Row label="고객분류" value={c.category} />
            <Row label="소개처" value={c.referrer} />
            <Row label="지역" value={[rg.sigungu, rg.dong].filter(Boolean).join(" · ")} />
            <Row label="우편번호" value={c.zip} />
            <Row label="주소" value={addr} />
            <Row label="전자메일" value={c.email} />
          </dl>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-1 text-sm font-semibold text-sky-800">제품 · 계약</h3>
          <dl className="divide-y divide-slate-100">
            <Row label="모델명" value={c.model} />
            <Row label="모터명" value={c.motor} />
            <Row label="제품번호" value={c.productNo} />
            <Row label="관리방법" value={c.mgmtType} />
            <Row label="판매구분" value={c.saleType} />
            <Row label="월납입액" value={c.monthlyFee ? won(c.monthlyFee) : ""} />
          </dl>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-800">필터 교환</h3>
            {c.filters.length > 0 && (
              <button onClick={onReplaceAll} className="rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 active:bg-sky-100">전체 오늘 교환</button>
            )}
          </div>
          {c.filters.length === 0 && <p className="text-sm text-slate-400">등록된 필터가 없습니다.</p>}
          <ul className="divide-y divide-slate-100">
            {c.filters.map((f, i) => {
              const d = dueDate(f);
              const left = daysLeft(d);
              return (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${dueTone(left)}`}>{dueLabel(left)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      주기 {cycleLabel(f.cycleDays)} · 최근 {f.lastChange} · 예정 {d}
                    </div>
                  </div>
                  <button onClick={() => onReplace(i)} disabled={f.lastChange === todayStr()}
                    className="shrink-0 rounded-lg border border-sky-200 px-3 py-2 text-sm font-medium text-sky-700 active:bg-sky-50 disabled:opacity-40">교환 완료</button>
                </li>
              );
            })}
          </ul>
        </section>

        {(c.note1 || c.note2 || c.ref1 || c.ref2 || c.memo) && (
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h3 className="mb-1 text-sm font-semibold text-sky-800">메모</h3>
            <dl className="divide-y divide-slate-100">
              <Row label="비고 1" value={c.note1} />
              <Row label="비고 2" value={c.note2} />
              <Row label="참고 1" value={c.ref1} />
              <Row label="참고 2" value={c.ref2} />
              <Row label="메모사항" value={c.memo} />
            </dl>
          </section>
        )}
      </div>
      <div className="flex gap-2 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button onClick={onDelete} className="flex-1 rounded-xl border border-red-200 py-3 font-medium text-red-600 active:bg-red-50">삭제</button>
        <button onClick={onEdit} className="flex-[2] rounded-xl bg-sky-700 py-3 font-semibold text-white active:bg-sky-800">수정</button>
      </div>
      </>)}
    </div>
  );
}
