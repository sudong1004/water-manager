import { expect, it } from "vitest";
import { parseBackup, planRestore } from "../lib/restore";
import type { Customer, Payment, ServiceRecord } from "../lib/types";
import { normalizeCustomer } from "../lib/utils";

const cust = (o: Partial<Customer>) => normalizeCustomer({ id: "1", name: "홍길동", ...o });
const pay = (o: Partial<Payment> = {}): Payment => ({ id: "p1", customerId: "1", date: "2026-10-01", kind: "수납", amount: 12000, method: "CMS", memo: "", ...o });
const rec = (o: Partial<ServiceRecord> = {}): ServiceRecord => ({ id: "r1", customerId: "1", date: "2026-10-01", type: "상담", content: "메모", nextVisit: "", ...o });

it("형식이 틀리면 거부", () => {
  expect(parseBackup(null).ok).toBe(false);
  expect(parseBackup({ customers: [], payments: [] }).ok).toBe(false);
  expect(parseBackup({ customers: [{ id: "1" }], payments: [], records: [] }).ok).toBe(false);
  expect(parseBackup({ customers: [], payments: [pay({ amount: 0 })], records: [] }).ok).toBe(false);
  expect(parseBackup({ customers: [], payments: [], records: [rec({ type: "이상한" as never })] }).ok).toBe(false);
});

it("올바른 백업은 통과하고 고객은 기본값이 채워짐", () => {
  const r = parseBackup({ customers: [{ id: "1", name: "홍길동" }], payments: [pay()], records: [rec()] });
  expect(r.ok && r.data.customers[0].filters).toEqual([]);
});

it("신규·변경·동일·현재에만을 구분하고, 키 순서가 달라도 같은 내용은 동일로 본다", () => {
  const cur = { customers: [cust({ id: "1" }), cust({ id: "2", name: "현재만" })], payments: [pay()], records: [rec()] };
  const reordered = JSON.parse(JSON.stringify(cur.payments[0], Object.keys(cur.payments[0]).sort()));
  const inc = {
    customers: [cust({ id: "1", memo: "바뀜" }), cust({ id: "3", name: "삭제됐던 고객" })],
    payments: [reordered],
    records: [rec(), rec({ id: "r2" })],
  };
  const plan = planRestore(cur, inc);
  expect(plan.customers).toEqual({ new: 1, changed: 1, same: 0, onlyCurrent: 1 });
  expect(plan.payments).toEqual({ new: 0, changed: 0, same: 1, onlyCurrent: 0 });
  expect(plan.records).toEqual({ new: 1, changed: 0, same: 1, onlyCurrent: 0 });
  expect(plan.write.customers.map((c) => c.id).sort()).toEqual(["1", "3"]);
  expect(plan.write.records).toHaveLength(1);
});

it("복원되는 기존 고객은 rev를 올려 오래된 화면의 덮어쓰기를 막음", () => {
  const cur = { customers: [cust({ id: "1", rev: 4 })], payments: [], records: [] };
  const plan = planRestore(cur, { customers: [cust({ id: "1", memo: "복원", rev: 2 })], payments: [], records: [] });
  expect(plan.write.customers[0].rev).toBe(5);
});

it("rev만 다른 고객은 변경으로 보지 않음", () => {
  const plan = planRestore({ customers: [cust({ rev: 3 })], payments: [], records: [] }, { customers: [cust({ rev: 1 })], payments: [], records: [] });
  expect(plan.customers.same).toBe(1);
});
