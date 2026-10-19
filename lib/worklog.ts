import type { Customer, Payment, ServiceRecord } from "./types";
import { fullAddr, roadFull } from "./utils";

export type WorkItem = {
  key: string;
  kind: "record" | "payment";
  id: string;
  date: string;
  type: string; // 필터교체 / 방문 / AS … / 수납 / 청구
  customerId: string;
  name: string;
  addr: string;
  road: string;
  content: string;
  filters: string[]; // 교환한 필터 이름들 (필터교체일 때)
  amount: number;
  method: string;
  entered: boolean;
};

export const TYPE_ICON: Record<string, string> = { 수납: "💰", 청구: "🧾", 방문: "🚗", 필터교체: "🔧", AS: "🛠", 상담: "💬", 민원: "⚠️", 특이사항: "📌" };
export const TYPE_ORDER = ["필터교체", "방문", "AS", "상담", "민원", "특이사항", "수납", "청구"];

/** 기록·수납을 하나의 업무 내역 목록으로 합침 (날짜 내림차순, 같은 날은 구분 순서) */
export function buildWorkItems(customers: Customer[], payments: Payment[], records: ServiceRecord[]): WorkItem[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const items: WorkItem[] = [];
  for (const r of records) {
    const c = byId.get(r.customerId);
    let filters: string[] = [];
    if (r.type === "필터교체") {
      filters = r.filters?.length ? r.filters.map((f) => f.name) : (c?.filters ?? []).filter((f) => r.content?.includes(f.name)).map((f) => f.name);
    }
    items.push({
      key: "r" + r.id, kind: "record", id: r.id, date: r.date, type: r.type, customerId: r.customerId,
      name: c?.name ?? "(삭제된 고객)", addr: c ? fullAddr(c) : "", road: c ? roadFull(c) : "",
      content: r.content ?? "", filters, amount: 0, method: "", entered: !!r.entered,
    });
  }
  for (const p of payments) {
    const c = byId.get(p.customerId);
    items.push({
      key: "p" + p.id, kind: "payment", id: p.id, date: p.date, type: p.kind, customerId: p.customerId,
      name: c?.name ?? "(삭제된 고객)", addr: c ? fullAddr(c) : "", road: c ? roadFull(c) : "",
      content: p.memo ?? "", filters: [], amount: p.amount, method: p.method ?? "", entered: !!p.entered,
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name, "ko"));
}

export const monthStart = (d: string) => d.slice(0, 7) + "-01";
export function monthEnd(d: string) {
  const [y, m] = d.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${d.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}
