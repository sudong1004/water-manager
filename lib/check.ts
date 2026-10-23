import type { Customer, ServiceRecord } from "./types";
import { daysLeft, pendingVisitRecord, todayStr } from "./utils";

export type IssueKind = "gap" | "mismatch" | "visit" | "future" | "nolink";
export type Issue = { kind: IssueKind; customerId: string; name: string; text: string };

export const ISSUE_LABEL: Record<IssueKind, { icon: string; title: string; hint: string }> = {
  gap: { icon: "📆", title: "방문일과 교체일이 다름", hint: "방문 이력과 필터교체 이력의 날짜가 1~2일 차이 납니다. 교체일을 다음 날 입력하면서 틀어졌을 수 있습니다." },
  mismatch: { icon: "🔧", title: "필터 교환일이 이력과 다름", hint: "필터의 최근 교환일이 이력의 마지막 교체일과 다릅니다. 엑셀 가져오기나 수동 수정으로 어긋났을 수 있습니다." },
  visit: { icon: "📅", title: "지난 방문 예정이 남아 있음", hint: "예정일이 지났는데 완료·취소하지 않았습니다." },
  future: { icon: "⏩", title: "교환일이 미래 날짜", hint: "필터 최근 교환일이 오늘보다 뒤입니다. 날짜를 잘못 입력했을 수 있습니다." },
  nolink: { icon: "❓", title: "교체 이력에 필터 정보 없음", hint: "필터교체 이력인데 어떤 필터인지 알 수 없어 교환일 자동 맞춤이 되지 않습니다." },
};

/** 데이터 점검: 사람이 확인해 봐야 할 의심 사례를 찾는다 (보기만 하고 고치지는 않음) */
export function findIssues(customers: Customer[], records: ServiceRecord[]): Issue[] {
  const today = todayStr();
  const byCust = new Map<string, ServiceRecord[]>();
  records.forEach((r) => byCust.set(r.customerId, [...(byCust.get(r.customerId) ?? []), r]));
  const out: Issue[] = [];

  for (const c of customers) {
    const rs = byCust.get(c.id) ?? [];
    const add = (kind: IssueKind, text: string) => out.push({ kind, customerId: c.id, name: c.name, text });
    const namesOf = (r: ServiceRecord) =>
      r.filters?.length ? r.filters.map((f) => f.name) : c.filters.filter((f) => r.content?.includes(f.name)).map((f) => f.name);
    const changes = rs.filter((r) => r.type === "필터교체");
    const visits = rs.filter((r) => r.type === "방문");

    // 방문 → (1~2일 뒤) 필터교체: 같은 방문에 묶인 교체는 한 줄로
    const gaps = new Map<string, { v: ServiceRecord; d: number; names: string[] }>();
    for (const f of changes) {
      if (visits.some((x) => x.date === f.date)) continue;
      const near = visits.filter((v) => { const d = daysLeft(f.date, v.date); return d >= 1 && d <= 2; }).sort((x, y) => y.date.localeCompare(x.date))[0];
      if (!near) continue;
      const g = gaps.get(near.id + f.date) ?? { v: near, d: daysLeft(f.date, near.date), names: [] as string[] };
      g.names.push(...namesOf(f));
      gaps.set(near.id + f.date, g);
    }
    gaps.forEach((g, k) => add("gap", `방문 ${g.v.date} · 교체 ${k.slice(g.v.id.length)} (${g.d}일 차이) ${g.names.join(", ")}`.trim()));
    for (const f of c.filters) {
      const dates = changes.filter((r) => namesOf(r).includes(f.name)).map((r) => r.date).sort();
      const last = dates.at(-1);
      if (last && last !== f.lastChange && f.lastChange <= today) add("mismatch", `${f.name}: 필터 ${f.lastChange} / 이력 ${last}`);
      if (f.lastChange > today) add("future", `${f.name}: ${f.lastChange}`);
    }
    for (const r of changes) if (!namesOf(r).length) add("nolink", `${r.date} "${(r.content ?? "").slice(0, 20)}"`);
    const pv = pendingVisitRecord(rs);
    if (pv && pv.nextVisit < today) add("visit", `${pv.nextVisit} (${-daysLeft(pv.nextVisit)}일 지남)`);
  }
  return out;
}
