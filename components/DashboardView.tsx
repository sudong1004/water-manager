"use client";
import type { VisitAct } from "./RecordsTab";
import { useEffect, useMemo, useState } from "react";
import type { Customer, Payment, ServiceRecord } from "../lib/types";
import { buildWorkItems, groupWork, TYPE_ICON } from "../lib/worklog";
import { addDays, todayStr, balanceOf, daysLeft, dueLabel, dueTone, monthOf, nextDue, pendingVisit, regionOf, sumBy, thisMonth, won } from "../lib/utils";

function Stat({ label, value, tone = "text-slate-900", onClick }: { label: string; value: string | number; tone?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 active:bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${tone}`}>{value}</div>
    </button>
  );
}
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold text-sky-800">{title}</h2>{action}</div>
      {children}
    </section>
  );
}
const Empty = ({ t }: { t: string }) => <p className="py-3 text-center text-sm text-slate-400">{t}</p>;

const TYPE_ORDER = ["수납", "청구", "필터교체", "방문", "AS", "상담", "민원", "특이사항"];
const PERIODS = [["all", "전체 기간"], ["7", "최근 7일"], ["30", "최근 30일"], ["90", "최근 3개월"]] as const;

function dayLabel(d: string) {
  const t = todayStr();
  if (d === t) return "오늘";
  if (d === addDays(t, -1)) return "어제";
  return d.slice(5).replace("-", "/");
}

/** 같은 고객·같은 날의 기록(필터교체·수납·AS…)은 한 칸으로 묶어서 보여줌 */
function ActivityFeed({ customers, payments, records, open }: { customers: Customer[]; payments: Payment[]; records: ServiceRecord[]; open: (id: string) => void }) {
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(10);

  const all = useMemo(() => buildWorkItems(customers, payments, records), [customers, payments, records]);
  const counts = new Map<string, number>();
  all.forEach((a) => counts.set(a.type, (counts.get(a.type) ?? 0) + 1));
  const types = TYPE_ORDER.filter((t) => counts.has(t));

  const since = period === "all" ? "" : addDays(todayStr(), -Number(period));
  const kw = q.trim().toLowerCase();
  const items = all.filter((a) => {
    if (type !== "all" && a.type !== type) return false;
    if (since && a.date < since) return false;
    if (kw && !(a.name + " " + a.content + " " + a.type + " " + a.filters.join(" ")).toLowerCase().includes(kw)) return false;
    return true;
  });
  const groups = useMemo(() => groupWork(items), [items]);
  const shown = groups.slice(0, limit);
  const byDate = new Map<string, typeof shown>();
  shown.forEach((g) => byDate.set(g.date, [...(byDate.get(g.date) ?? []), g]));
  const reset = () => setLimit(10);
  const chip = (k: string, label: string) => (
    <button key={k} onClick={() => { setType(k); reset(); }}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${type === k ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>
  );

  return (
    <Card title="🕘 최근 활동" action={<span className="text-xs text-slate-400">{groups.length}곳 · {items.length}건</span>}>
      <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {chip("all", `전체 ${all.length}`)}
        {types.map((t) => chip(t, `${TYPE_ICON[t]} ${t} ${counts.get(t)}`))}
      </div>
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} type="search" placeholder="고객명 · 내용 검색"
          className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        <select value={period} onChange={(e) => { setPeriod(e.target.value as typeof period); reset(); }}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none">
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {shown.length === 0 ? (
        <Empty t={all.length === 0 ? "아직 기록이 없습니다. 고객 상세에서 수납·이력을 기록하거나 필터 교환 완료를 누르면 여기에 쌓입니다." : "조건에 맞는 기록이 없습니다."} />
      ) : (
        <div className="space-y-3">
          {Array.from(byDate.entries()).map(([d, list]) => (
            <div key={d}>
              <div className="mb-1 text-xs font-bold text-slate-500">{dayLabel(d)}{dayLabel(d) !== d.slice(5).replace("-", "/") && <span className="ml-1 font-normal text-slate-400">{d.slice(5).replace("-", "/")}</span>}</div>
              <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-100">
                {list.map((g) => (
                  <li key={g.key}>
                    <button onClick={() => open(g.customerId)} className="block w-full px-3 py-2.5 text-left active:bg-slate-50">
                      <span className="flex items-baseline gap-2"><span className="truncate font-semibold">{g.name}</span><span className="shrink-0 text-xs text-slate-400">No.{g.customerId}</span></span>
                      <span className="mt-1 block space-y-0.5">
                        {g.lines.map((l, i) => (
                          <span key={i} className={`flex items-start gap-1.5 text-sm ${l.tone === "pay" ? "font-semibold text-emerald-700" : l.tone === "bill" ? "font-semibold text-red-600" : "text-slate-600"}`}>
                            <span className="shrink-0">{l.icon}</span><span className="min-w-0 break-words">{l.text}</span>
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {groups.length > limit && (
        <button onClick={() => setLimit(limit + 10)} className="mt-2 w-full rounded-lg bg-slate-50 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-100">
          더 보기 ({groups.length - limit}곳 남음)
        </button>
      )}
    </Card>
  );
}

export default function DashboardView({
  customers, payments, records, open, go, onVisit, onBackup,
}: {
  customers: Customer[]; payments: Payment[]; records: ServiceRecord[];
  open: (id: string) => void; go: (t: "customers" | "payments", f?: string) => void; onVisit: VisitAct; onBackup: () => void;
}) {
  const month = thisMonth();
  const [backupAge, setBackupAge] = useState<number | null | undefined>(undefined); // undefined=확인 전, null=기록 없음
  useEffect(() => {
    try { const d = localStorage.getItem("lastBackup"); setBackupAge(d ? Math.round((Date.now() - new Date(d).getTime()) / 86400000) : null); } catch { setBackupAge(undefined); }
  }, []);
  const byCust = (id: string) => customers.find((c) => c.id === id);

  const due = customers.map((c) => ({ c, d: nextDue(c) })).filter((x) => x.d) as { c: Customer; d: NonNullable<ReturnType<typeof nextDue>> }[];
  due.sort((a, b) => a.d.left - b.d.left);
  const overdue = due.filter((x) => x.d.left < 0).length;

  const payBy = new Map<string, Payment[]>();
  payments.forEach((p) => payBy.set(p.customerId, [...(payBy.get(p.customerId) ?? []), p]));
  const debtors = customers.map((c) => ({ c, bal: balanceOf(payBy.get(c.id) ?? []) })).filter((x) => x.bal > 0).sort((a, b) => b.bal - a.bal);
  const totalDebt = debtors.reduce((s, x) => s + x.bal, 0);
  const monthPaid = sumBy(payments.filter((p) => monthOf(p.date) === month), "수납");

  const recBy = new Map<string, ServiceRecord[]>();
  records.forEach((r) => recBy.set(r.customerId, [...(recBy.get(r.customerId) ?? []), r]));
  const visits = customers.map((c) => ({ c, v: pendingVisit(recBy.get(c.id) ?? []) })).filter((x) => x.v) as { c: Customer; v: string }[];
  visits.sort((a, b) => a.v.localeCompare(b.v));

  const recent = [...customers].sort((a, b) => b.regDate.localeCompare(a.regDate) || Number(b.id) - Number(a.id)).slice(0, 5);
  const newThisMonth = customers.filter((c) => monthOf(c.regDate) === month).length;

  const regionCount = new Map<string, number>();
  customers.forEach((c) => { const r = regionOf(c).sigungu; regionCount.set(r, (regionCount.get(r) ?? 0) + 1); });
  const regions = [...regionCount].sort((a, b) => b[1] - a[1]);
  const maxR = Math.max(1, ...regions.map((r) => r[1]));

  const Row = ({ id, name, sub, badge }: { id: string; name: string; sub: string; badge: React.ReactNode }) => (
    <li><button onClick={() => open(id)} className="flex w-full items-center gap-2 py-2.5 text-left active:bg-slate-50">
      <div className="min-w-0 flex-1"><div className="truncate font-medium">{name}</div><div className="truncate text-xs text-slate-500">{sub}</div></div>{badge}
    </button></li>
  );

  return (
    <div className="space-y-4 px-4 pt-4">
      {backupAge !== undefined && (backupAge === null || backupAge > 14) && (
        <button onClick={onBackup} className="flex w-full items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 ring-1 ring-amber-200 active:bg-amber-100">
          <span>💾 {backupAge === null ? "이 기기에서 백업한 기록이 없습니다." : `마지막 백업이 ${backupAge}일 전입니다.`} 백업을 받아 두세요.</span>
          <span className="shrink-0 font-semibold">백업하기 ›</span>
        </button>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="전체 고객" value={customers.length} onClick={() => go("customers")} />
        <Stat label="이번 달 신규" value={newThisMonth} tone="text-sky-700" />
        <Stat label="교환 지연" value={overdue} tone="text-red-600" onClick={() => go("customers", "overdue")} />
        <Stat label="방문 예정" value={visits.length} tone="text-violet-600" />
        <Stat label="이번 달 수납" value={won(monthPaid)} tone="text-emerald-600" onClick={() => go("payments")} />
        <Stat label="총 미수금" value={won(totalDebt)} tone={totalDebt ? "text-red-600" : "text-slate-400"} onClick={() => go("payments")} />
      </div>

      <ActivityFeed customers={customers} payments={payments} records={records} open={open} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`📅 방문 예정${visits.some((x) => daysLeft(x.v) < 0) ? ` · 지남 ${visits.filter((x) => daysLeft(x.v) < 0).length}` : ""}`}>
          {visits.length === 0 ? <Empty t="예정된 방문이 없습니다. (고객 이력에서 다음 방문일을 정하면 여기 표시)" /> : (
            <ul className="divide-y divide-slate-100">{visits.slice(0, 8).map(({ c, v }) => (
              <Row key={c.id} id={c.id} name={c.name} sub={`${v} · ${regionOf(c).sigungu} ${regionOf(c).dong}`}
                badge={<>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${dueTone(daysLeft(v))}`}>{dueLabel(daysLeft(v))}</span>
                  <span role="button" onClick={(e) => { e.stopPropagation(); onVisit(c.id, { type: "done" }); }} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white active:bg-emerald-700">완료</span>
                </>} />
            ))}</ul>
          )}
        </Card>

        <Card title="🔧 필터 교체 임박·지연" action={<button onClick={() => go("customers", "overdue")} className="text-xs text-sky-700">전체 보기</button>}>
          {due.length === 0 ? <Empty t="필터 정보가 없습니다." /> : (
            <ul className="divide-y divide-slate-100">{due.slice(0, 6).map(({ c, d }) => (
              <Row key={c.id} id={c.id} name={c.name} sub={`${d.filter.name} · ${d.date} · ${regionOf(c).sigungu}`}
                badge={<span className={`rounded-full px-2.5 py-1 text-xs font-bold ${dueTone(d.left)}`}>{dueLabel(d.left)}</span>} />
            ))}</ul>
          )}
        </Card>

        <Card title="💰 미수금 고객" action={<button onClick={() => go("payments")} className="text-xs text-sky-700">수납 관리</button>}>
          {debtors.length === 0 ? <Empty t="미수금이 없습니다. (고객 상세 > 수납 탭에서 청구를 기록하면 계산)" /> : (
            <ul className="divide-y divide-slate-100">{debtors.slice(0, 6).map(({ c, bal }) => (
              <Row key={c.id} id={c.id} name={c.name} sub={`${regionOf(c).sigungu} ${regionOf(c).dong}`} badge={<span className="text-sm font-bold text-red-600">{won(bal)}</span>} />
            ))}</ul>
          )}
        </Card>

        <Card title="🆕 최근 등록 고객">
          <ul className="divide-y divide-slate-100">{recent.map((c) => (
            <Row key={c.id} id={c.id} name={c.name} sub={`등록 ${c.regDate} · No.${c.id}`} badge={<span className="text-xs text-slate-500">{regionOf(c).sigungu}</span>} />
          ))}</ul>
        </Card>
      </div>

      <Card title="🗺 지역별 고객 수">
        <ul className="space-y-1.5">{regions.map(([r, n]) => (
          <li key={r} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-slate-600">{r}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-sky-500" style={{ width: `${(n / maxR) * 100}%` }} /></div>
            <span className="w-8 text-right font-semibold">{n}</span>
          </li>
        ))}</ul>
      </Card>
    </div>
  );
}
