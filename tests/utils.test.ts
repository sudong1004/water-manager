import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dueDate, nextDue, pendingVisit, pendingVisitRecord } from "../lib/utils";
import type { Customer, ServiceRecord } from "../lib/types";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 23, 12)); }); // 2026-10-23
afterEach(() => vi.useRealTimers());

const rec = (o: Partial<ServiceRecord>): ServiceRecord => ({ id: Math.random().toString(), customerId: "1", date: "2026-10-01", type: "상담", content: "", nextVisit: "", ...o });
const cust = (filters: Customer["filters"]) => ({ id: "1", filters } as Customer);

describe("dueDate / nextDue", () => {
  it("최근 교환일 + 주기", () => {
    expect(dueDate({ name: "세디", cycleDays: 121, lastChange: "2026-10-23" })).toBe("2027-02-21");
  });
  it("직접 지정한 예정일이 우선", () => {
    expect(dueDate({ name: "세디", cycleDays: 121, lastChange: "2026-10-23", nextDate: "2027-02-28" })).toBe("2027-02-28");
  });
  it("최근 교환일 없이 예정일만 있어도 계산됨, 둘 다 없으면 빈 값", () => {
    expect(dueDate({ name: "세디", cycleDays: 121, lastChange: "", nextDate: "2027-02-28" })).toBe("2027-02-28");
    expect(dueDate({ name: "세디", cycleDays: 121, lastChange: "" })).toBe("");
  });
  it("nextDue는 가장 빠른 예정 필터를 고르고 예정 없는 필터는 건너뜀", () => {
    const c = cust([{ name: "A", cycleDays: 100, lastChange: "" }, { name: "UF", cycleDays: 730, lastChange: "2026-06-05" }, { name: "B", cycleDays: 121, lastChange: "2026-06-05" }]);
    const d = nextDue(c)!;
    expect(d.filter.name).toBe("B");
    expect(d.date).toBe("2026-10-04");
    expect(d.left).toBe(-19); // 10/23 기준 19일 지연
  });
});

describe("pendingVisit (방문 예정)", () => {
  it("예정이 없으면 null", () => expect(pendingVisit([rec({})])).toBeNull());
  it("예약이 있으면 그 예정일", () => {
    expect(pendingVisit([rec({ type: "방문예약", date: "2026-10-20", nextVisit: "2026-10-30" })])).toBe("2026-10-30");
  });
  it("그 뒤에 필터교체 이력이 생기면 예정일 전이어도 완료", () => {
    const rs = [rec({ type: "방문예약", date: "2026-10-20", nextVisit: "2026-10-30" }), rec({ type: "필터교체", date: "2026-10-22" })];
    expect(pendingVisit(rs)).toBeNull();
  });
  it("통화·메모(상담)는 방문으로 치지 않음", () => {
    const rs = [rec({ type: "방문예약", date: "2026-10-20", nextVisit: "2026-10-30" }), rec({ type: "상담", date: "2026-11-05" })];
    expect(pendingVisit(rs)).toBe("2026-10-30");
  });
  it("완료/취소 처리(visitClosed)하면 예정에서 빠짐", () => {
    expect(pendingVisitRecord([rec({ type: "방문예약", nextVisit: "2026-10-30", visitClosed: true })])).toBeNull();
  });
  it("가장 최근에 잡은 예약이 기준", () => {
    const rs = [rec({ type: "방문예약", date: "2026-10-10", nextVisit: "2026-10-15" }), rec({ type: "방문예약", date: "2026-10-12", nextVisit: "2026-10-28" })];
    expect(pendingVisit(rs)).toBe("2026-10-28");
  });
});
