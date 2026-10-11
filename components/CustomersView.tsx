"use client";
import { useMemo, useState } from "react";
import type { Customer } from "../lib/types";
import { dueLabel, dueTone, firstPhone, fullAddr, nextDue, pendingVisit, regionOf, toCSV, todayStr, won } from "../lib/utils";
import type { ServiceRecord } from "../lib/types";

type Seg = "all" | "overdue" | "soon" | "ok";
type Sort = "due" | "region" | "name" | "recent";

export default function CustomersView({
  customers, balances, records, initialSeg, open, onNew,
}: {
  customers: Customer[]; balances: Map<string, number>; records: ServiceRecord[];
  initialSeg: Seg; open: (id: string) => void; onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Seg>(initialSeg);
  const [mgmt, setMgmt] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [dong, setDong] = useState("");
  const [debtOnly, setDebtOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("due");

  const rows = useMemo(() => customers.map((c) => ({ c, due: nextDue(c), rg: regionOf(c) })), [customers]);
  const counts = useMemo(() => ({
    all: rows.length,
    overdue: rows.filter((r) => r.due && r.due.left < 0).length,
    soon: rows.filter((r) => r.due && r.due.left >= 0 && r.due.left <= 14).length,
    ok: rows.filter((r) => !r.due || r.due.left > 14).length,
  }), [rows]);
  const sigunguList = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.rg.sigungu, (m.get(r.rg.sigungu) ?? 0) + 1));
    return [...m].sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [rows]);
  const dongList = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.rg.sigungu === sigungu).forEach((r) => r.rg.dong && m.set(r.rg.dong, (m.get(r.rg.dong) ?? 0) + 1));
    return [...m].sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [rows, sigungu]);
  const mgmtOptions = useMemo(() => Array.from(new Set(customers.map((c) => c.mgmtType).filter(Boolean))), [customers]);

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const kd = kw.replace(/\D/g, "");
    const r = rows.filter(({ c, due, rg }) => {
      if (seg === "overdue" && !(due && due.left < 0)) return false;
      if (seg === "soon" && !(due && due.left >= 0 && due.left <= 14)) return false;
      if (seg === "ok" && due && due.left <= 14) return false;
      if (mgmt && c.mgmtType !== mgmt) return false;
      if (sigungu && rg.sigungu !== sigungu) return false;
      if (dong && rg.dong !== dong) return false;
      if (debtOnly && !(balances.get(c.id) ?? 0)) return false;
      if (!kw) return true;
      if ([c.id, c.name, c.contactPerson, fullAddr(c), c.note1, c.note2, c.memo, c.model].join(" ").toLowerCase().includes(kw)) return true;
      return kd.length >= 3 && [c.mobile1, c.mobile2, c.tel1, c.tel2].some((p) => p.replace(/\D/g, "").includes(kd));
    });
    return [...r].sort((a, b) =>
      sort === "name" ? a.c.name.localeCompare(b.c.name, "ko")
      : sort === "region" ? a.rg.sigungu.localeCompare(b.rg.sigungu, "ko") || a.rg.dong.localeCompare(b.rg.dong, "ko") || a.c.addr2.localeCompare(b.c.addr2, "ko")
      : sort === "recent" ? b.c.regDate.localeCompare(a.c.regDate) || Number(b.c.id) - Number(a.c.id)
      : (a.due?.left ?? 99999) - (b.due?.left ?? 99999));
  }, [rows, q, seg, mgmt, sigungu, dong, debtOnly, sort, balances]);

  const visitOf = (id: string) => pendingVisit(records.filter((r) => r.customerId === id));
  function download() {
    const blob = new Blob([toCSV(shown.map((s) => s.c))], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `고객목록_${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  const segs: { k: Seg; label: string; tone: string }[] = [
    { k: "all", label: "전체", tone: "text-slate-900" }, { k: "overdue", label: "교환 지연", tone: "text-red-600" },
    { k: "soon", label: "14일 내", tone: "text-amber-600" }, { k: "ok", label: "정상", tone: "text-emerald-600" },
  ];
  const sel = "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none";
  let lastGroup = "";

  return (
    <div className="px-4 pt-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="이름 · 전화번호 · 주소 · 관리번호 검색"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200" />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {segs.map((s) => (
          <button key={s.k} onClick={() => setSeg(s.k)} className={`rounded-xl bg-white p-2.5 text-center shadow-sm ring-1 ${seg === s.k ? "ring-2 ring-sky-600" : "ring-slate-200"}`}>
            <div className={`text-xl font-bold ${s.tone}`}>{counts[s.k]}</div><div className="text-[11px] text-slate-500 sm:text-xs">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={sel} value={sigungu} onChange={(e) => { setSigungu(e.target.value); setDong(""); }}>
          <option value="">지역 전체</option>
          {sigunguList.map(([n, k]) => <option key={n} value={n}>{n} ({k})</option>)}
        </select>
        {sigungu && (
          <select className={sel} value={dong} onChange={(e) => setDong(e.target.value)}>
            <option value="">{sigungu} 전체 동</option>
            {dongList.map(([n, k]) => <option key={n} value={n}>{n} ({k})</option>)}
          </select>
        )}
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="due">교환 임박순</option><option value="region">지역순</option><option value="recent">최근 등록순</option><option value="name">이름순</option>
        </select>
        <select className={sel} value={mgmt} onChange={(e) => setMgmt(e.target.value)}>
          <option value="">관리방법 전체</option>{mgmtOptions.map((m) => <option key={m}>{m}</option>)}
        </select>
        <button onClick={() => setDebtOnly(!debtOnly)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${debtOnly ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600"}`}>미수금만</button>
        <span className="ml-auto flex items-center gap-2 text-sm text-slate-500">{shown.length}명
          <button onClick={download} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">CSV</button>
          <button onClick={onNew} className="hidden rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white sm:block">+ 신규등록</button>
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="py-20 text-center text-slate-400">{customers.length === 0 ? "등록된 고객이 없습니다." : "검색 결과가 없습니다."}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ c, due, rg }) => {
            const group = sort === "region" ? `${rg.sigungu} ${rg.dong}`.trim() : "";
            const header = group && group !== lastGroup ? group : "";
            if (group) lastGroup = group;
            const bal = balances.get(c.id) ?? 0;
            const visit = visitOf(c.id);
            return (
              <li key={c.id} className="contents">
                {header && <div className="col-span-full -mb-1 mt-1 text-sm font-bold text-sky-800">📍 {header}</div>}
                <button onClick={() => open(c.id)} className="block w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99] active:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{c.name}{c.contactPerson && <span className="ml-1.5 text-sm font-normal text-slate-500">({c.contactPerson})</span>}</div>
                      <div className="mt-0.5 text-xs text-slate-400">No.{c.id} · {c.mgmtType || "-"} · 등록 {c.regDate}</div>
                    </div>
                    {due && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${dueTone(due.left)}`}>{dueLabel(due.left)}</span>}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{fullAddr(c) || "주소 없음"}</div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-sky-700">{firstPhone(c) || "연락처 없음"}</span>
                    {due && <span className="text-xs text-slate-500">{due.filter.name} · {due.date}</span>}
                  </div>
                  {(bal > 0 || visit) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bal > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">미수 {won(bal)}</span>}
                      {visit && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">방문 {visit}</span>}
                    </div>
                  )}
                  {c.note1 && <div className="mt-2 truncate rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">{c.note1}</div>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
