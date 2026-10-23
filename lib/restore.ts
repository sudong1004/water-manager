import type { Customer, Payment, ServiceRecord } from "./types";
import { normalizeCustomer } from "./utils";
import { validatePayment, validateRecord } from "./validators";

export type Backup = { customers: Customer[]; payments: Payment[]; records: ServiceRecord[] };
export type Part = { new: number; changed: number; same: number };
export type Plan = {
  customers: Part & { onlyCurrent: number }; payments: Part & { onlyCurrent: number }; records: Part & { onlyCurrent: number };
  write: Backup; // 실제로 저장할 행 (신규 + 변경만)
};

/** 백업 JSON 검증: 하나라도 형식이 틀리면 거부 (일부만 복원되는 상황 방지) */
export function parseBackup(raw: unknown): { ok: true; data: Backup } | { ok: false; error: string } {
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== "object" || !Array.isArray(b.customers) || !Array.isArray(b.payments) || !Array.isArray(b.records))
    return { ok: false, error: "백업 파일 형식이 아닙니다. 이 앱에서 받은 JSON 백업 파일을 선택해 주세요." };
  const bad = (what: string, i: number, why: string) => ({ ok: false as const, error: `${what} ${i + 1}번째 항목이 올바르지 않습니다: ${why}` });
  for (const [i, c] of b.customers.entries()) {
    if (!c || typeof c.id !== "string" || !c.id.trim()) return bad("고객", i, "관리번호가 없습니다");
    if (typeof c.name !== "string" || !c.name.trim()) return bad("고객", i, "고객명이 없습니다");
  }
  for (const [i, p] of b.payments.entries()) {
    if (!p || typeof p.id !== "string" || !p.id) return bad("수납", i, "id가 없습니다");
    const e = validatePayment(p); if (e) return bad("수납", i, e);
  }
  for (const [i, r] of b.records.entries()) {
    if (!r || typeof r.id !== "string" || !r.id) return bad("이력", i, "id가 없습니다");
    const e = validateRecord(r); if (e) return bad("이력", i, e);
  }
  return { ok: true, data: { customers: b.customers.map(normalizeCustomer), payments: b.payments, records: b.records } };
}

// 키 순서가 달라도(DB가 순서를 바꿈) 같은 내용이면 같은 문자열
const stable = (v: unknown) =>
  JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));

function diff<T extends { id: string }>(cur: T[], inc: T[], same: (a: T, b: T) => boolean) {
  const byId = new Map(cur.map((r) => [r.id, r]));
  const part = { new: 0, changed: 0, same: 0, onlyCurrent: 0 };
  const rows: T[] = [];
  const seen = new Set<string>();
  for (const r of inc) {
    seen.add(r.id);
    const old = byId.get(r.id);
    if (!old) { part.new++; rows.push(r); } else if (same(old, r)) part.same++; else { part.changed++; rows.push(r); }
  }
  part.onlyCurrent = cur.filter((r) => !seen.has(r.id)).length;
  return { part, rows };
}

/** 병합 복원 계획: 파일의 내용으로 덮어쓰거나 추가하고, 현재에만 있는 데이터는 건드리지 않는다 */
export function planRestore(cur: Backup, inc: Backup): Plan {
  const curRev = new Map(cur.customers.map((c) => [c.id, c.rev ?? 0]));
  const noRev = (c: Customer) => stable({ ...normalizeCustomer(c), rev: undefined }); // 기본값이 빠진 옛 행과도 공정하게 비교
  const c = diff(cur.customers, inc.customers, (a, b) => noRev(a) === noRev(b));
  const p = diff(cur.payments, inc.payments, (a, b) => stable(a) === stable(b));
  const r = diff(cur.records, inc.records, (a, b) => stable(a) === stable(b));
  return {
    customers: c.part, payments: p.part, records: r.part,
    // 복원된 고객은 번호를 올려서, 오래된 화면에서 저장해 복원 내용을 덮어쓰는 일을 막는다
    write: { customers: c.rows.map((x) => ({ ...x, rev: (curRev.get(x.id) ?? x.rev ?? 0) + (curRev.has(x.id) ? 1 : 0) })), payments: p.rows, records: r.rows },
  };
}
