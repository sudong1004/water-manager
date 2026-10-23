import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findIssues } from "../lib/check";
import type { Customer, ServiceRecord } from "../lib/types";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 23, 12)); });
afterEach(() => vi.useRealTimers());

const rec = (o: Partial<ServiceRecord>): ServiceRecord => ({ id: Math.random().toString(), customerId: "1", date: "2026-10-01", type: "상담", content: "", nextVisit: "", ...o });
const c = (filters: Customer["filters"]) => ({ id: "1", name: "홍길동", filters } as Customer);

it("방문 다음 날 교체를 입력하면 날짜 차이로 표시하고 같은 방문의 교체는 한 줄로 묶음", () => {
  const rs = [
    rec({ type: "방문", date: "2026-10-22" }),
    rec({ type: "필터교체", date: "2026-10-23", filters: [{ name: "세디", prev: "" }] }),
    rec({ type: "필터교체", date: "2026-10-23", filters: [{ name: "카본", prev: "" }] }),
  ];
  const gaps = findIssues([c([])], rs).filter((i) => i.kind === "gap");
  expect(gaps).toHaveLength(1);
  expect(gaps[0].text).toContain("세디, 카본");
});

it("필터 교환일이 이력의 마지막 교체일과 다르면 표시, 비어 있거나 미래 날짜는 표시 안 함", () => {
  const rs = [rec({ type: "필터교체", date: "2026-09-01", filters: [{ name: "세디", prev: "" }] })];
  const filters = [
    { name: "세디", cycleDays: 121, lastChange: "2026-10-01" },
    { name: "카본", cycleDays: 121, lastChange: "" },
  ];
  expect(findIssues([c(filters)], rs).filter((i) => i.kind === "mismatch").map((i) => i.text)).toEqual(["세디: 필터 2026-10-01 / 이력 2026-09-01"]);
  expect(findIssues([c([{ name: "세디", cycleDays: 121, lastChange: "2027-01-01" }])], rs).filter((i) => i.kind === "mismatch")).toHaveLength(0);
});

it("지난 방문 예약이 처리되지 않았으면 표시", () => {
  const rs = [rec({ type: "방문예약", date: "2026-10-01", nextVisit: "2026-10-10" })];
  expect(findIssues([c([])], rs).filter((i) => i.kind === "visit")).toHaveLength(1);
});

it("어떤 필터인지 알 수 없는 필터교체 이력은 표시", () => {
  const rs = [rec({ type: "필터교체", content: "뭔가" })];
  expect(findIssues([c([{ name: "세디", cycleDays: 121, lastChange: "2026-01-01" }])], rs).filter((i) => i.kind === "nolink")).toHaveLength(1);
});
