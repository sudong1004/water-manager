import { expect, it } from "vitest";
import { mergeCustomer } from "../lib/excel";
import { normalizeCustomer } from "../lib/utils";

const base = normalizeCustomer({ id: "1", name: "홍길동", mobile1: "010-1111-2222", memo: "직접 쓴 메모" });

it("엑셀의 빈 칸은 기존 값을 지우지 않음", () => {
  const { merged, changed } = mergeCustomer(base, normalizeCustomer({ id: "1", name: "홍길동", mobile1: "", memo: "" }));
  expect(merged.mobile1).toBe("010-1111-2222");
  expect(merged.memo).toBe("직접 쓴 메모");
  expect(changed).toEqual([]);
});

it("값이 바뀌면 변경으로 표시", () => {
  const { merged, changed } = mergeCustomer(base, normalizeCustomer({ id: "1", name: "홍길동", mobile1: "010-9999-0000" }));
  expect(merged.mobile1).toBe("010-9999-0000");
  expect(changed.length).toBe(1);
});

it("필터 최근 교환일은 더 최근 날짜를 유지 (앱에서 교환 완료한 기록 보존)", () => {
  const old = { ...base, filters: [{ name: "세디", cycleDays: 121, lastChange: "2026-10-23" }] };
  const inc = { ...base, filters: [{ name: "세디", cycleDays: 121, lastChange: "2026-06-05" }] };
  expect(mergeCustomer(old, inc).merged.filters[0].lastChange).toBe("2026-10-23");
});

it("직접 지정한 예정일은 교환일이 그대로면 유지, 엑셀이 더 최근 교환일을 주면 해제", () => {
  const old = { ...base, filters: [{ name: "세디", cycleDays: 121, lastChange: "2026-06-05", nextDate: "2027-02-28" }] };
  expect(mergeCustomer(old, { ...base, filters: [{ name: "세디", cycleDays: 120, lastChange: "2026-06-05" }] }).merged.filters[0].nextDate).toBe("2027-02-28");
  expect(mergeCustomer(old, { ...base, filters: [{ name: "세디", cycleDays: 121, lastChange: "2026-09-01" }] }).merged.filters[0].nextDate).toBeUndefined();
});

it("새 필터는 추가됨", () => {
  const { merged, changed } = mergeCustomer(base, { ...base, filters: [{ name: "UF", cycleDays: 730, lastChange: "2026-06-05" }] });
  expect(merged.filters.map((f) => f.name)).toEqual(["UF"]);
  expect(changed).toContain("필터");
});
