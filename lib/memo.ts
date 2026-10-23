import type { Customer, ServiceRecord } from "./types";

export const memoLine = (date: string, content: string) => `[${date.slice(5)}] ${content.trim().replace(/\s*\n\s*/g, " ")}`;

/** 예전 특이사항 이력을 고객 메모(메모사항)에 옮긴다. 이미 같은 줄이 메모에 있으면 건너뛰므로 여러 번 실행해도 중복되지 않는다. */
export function backfillMemos(customers: Customer[], records: ServiceRecord[]): { customers: Customer[]; added: number; changed: Customer[] } {
  const by = new Map<string, ServiceRecord[]>();
  records.filter((r) => r.type === "특이사항" && r.content?.trim()).forEach((r) => by.set(r.customerId, [...(by.get(r.customerId) ?? []), r]));
  let added = 0;
  const changed: Customer[] = [];
  const out = customers.map((c) => {
    const rs = (by.get(c.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (!rs.length) return c;
    const have = new Set((c.memo ?? "").split("\n").map((l) => l.trim()));
    const lines = rs.map((r) => memoLine(r.date, r.content)).filter((l) => !have.has(l));
    if (!lines.length) return c;
    added += lines.length;
    const next = { ...c, memo: [c.memo?.trimEnd(), ...lines].filter(Boolean).join("\n") };
    changed.push(next);
    return next;
  });
  return { customers: out, added, changed };
}
