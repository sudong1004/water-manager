"use client";
import type { Customer, Payment, ServiceRecord } from "../lib/types";
import { balanceOf, daysLeft, dueLabel, dueTone, monthOf, nextDue, pendingVisit, regionOf, sumBy, thisMonth, won } from "../lib/utils";

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

export default function DashboardView({
  customers, payments, records, open, go,
}: {
  customers: Customer[]; payments: Payment[]; records: ServiceRecord[];
  open: (id: string) => void; go: (t: "customers" | "payments", f?: string) => void;
}) {
  const month = thisMonth();
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="전체 고객" value={customers.length} onClick={() => go("customers")} />
        <Stat label="이번 달 신규" value={newThisMonth} tone="text-sky-700" />
        <Stat label="교환 지연" value={overdue} tone="text-red-600" onClick={() => go("customers", "overdue")} />
        <Stat label="방문 예정" value={visits.length} tone="text-violet-600" />
        <Stat label="이번 달 수납" value={won(monthPaid)} tone="text-emerald-600" onClick={() => go("payments")} />
        <Stat label="총 미수금" value={won(totalDebt)} tone={totalDebt ? "text-red-600" : "text-slate-400"} onClick={() => go("payments")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="📅 방문 예정">
          {visits.length === 0 ? <Empty t="예정된 방문이 없습니다. (고객 이력에서 다음 방문일을 정하면 여기 표시)" /> : (
            <ul className="divide-y divide-slate-100">{visits.slice(0, 6).map(({ c, v }) => (
              <Row key={c.id} id={c.id} name={c.name} sub={`${v} · ${regionOf(c).sigungu} ${regionOf(c).dong}`}
                badge={<span className={`rounded-full px-2.5 py-1 text-xs font-bold ${dueTone(daysLeft(v))}`}>{dueLabel(daysLeft(v))}</span>} />
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
