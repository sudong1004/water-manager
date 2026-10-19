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

// ───────── 같은 고객·같은 날을 한 묶음으로 ─────────
export type Group = {
  key: string; date: string; customerId: string; name: string; addr: string; road: string;
  filters: string[]; // 그날 교환한 필터 (중복 제거)
  paid: number; billed: number; methods: string[];
  others: string[]; // 방문·AS·상담 등 "구분: 내용"
  lines: { icon: string; text: string; tone?: "pay" | "bill" }[]; // 화면 표시용 줄
  text: string; // 한 줄 요약 (복사·인쇄용)
  items: WorkItem[]; entered: boolean;
};

const autoText = (it: WorkItem) => it.filters.length > 0 && (it.content.trim() === "" || it.content.trim().endsWith("교체") && it.filters.every((f) => it.content.includes(f)));

export function groupWork(items: WorkItem[]): Group[] {
  const m = new Map<string, WorkItem[]>();
  items.forEach((it) => m.set(`${it.date}|${it.customerId}`, [...(m.get(`${it.date}|${it.customerId}`) ?? []), it]));
  return Array.from(m.entries()).map(([key, list]) => {
    const first = list[0];
    const filters: string[] = [];
    const others: string[] = [];
    const methods: string[] = [];
    let paid = 0, billed = 0;
    const lines: Group["lines"] = [];
    // 같은 종류끼리는 입력한 순서(오래된 것 먼저)로 — 목록은 최신 입력이 앞이라 뒤집어 읽는다
    const sorted = list.map((it, i) => ({ it, i })).sort((a, b) => TYPE_ORDER.indexOf(a.it.type) - TYPE_ORDER.indexOf(b.it.type) || b.i - a.i).map((x) => x.it);
    for (const it of sorted) {
      if (it.type === "필터교체") {
        it.filters.forEach((f) => !filters.includes(f) && filters.push(f));
        if (!autoText(it) && it.content.trim()) others.push(`필터교체: ${it.content.trim()}`);
        if (!it.filters.length && it.content.trim() === "") others.push("필터교체");
      } else if (it.type === "수납") { paid += it.amount; if (it.method && !methods.includes(it.method)) methods.push(it.method); }
      else if (it.type === "청구") billed += it.amount;
      else others.push(it.content.trim() ? `${it.type}: ${it.content.trim()}` : it.type);
    }
    if (filters.length) lines.push({ icon: "🔧", text: `${filters.join(" · ")} 교체` });
    others.forEach((o) => lines.push({ icon: TYPE_ICON[o.split(":")[0]] ?? "📝", text: o }));
    if (paid) lines.push({ icon: "💰", text: `수납 ${paid.toLocaleString()}원${methods.length ? ` (${methods.join("·")})` : ""}`, tone: "pay" });
    if (billed) lines.push({ icon: "🧾", text: `청구 ${billed.toLocaleString()}원`, tone: "bill" });
    return {
      key, date: first.date, customerId: first.customerId, name: first.name, addr: first.addr, road: first.road,
      filters, paid, billed, methods, others, lines, text: lines.map((l) => l.text).join(" / "),
      items: list, entered: list.every((i) => i.entered),
    };
  });
}
