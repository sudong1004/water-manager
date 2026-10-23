import type { Customer, FilterItem, Payment, ServiceRecord } from "./types";

const DAY = 86400000;
const toUTC = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

export const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const addDays = (d: string, n: number) => fmt(toUTC(d) + n * DAY);
/** 교환 예정일: 직접 지정한 날짜가 우선, 없으면 최근 교환일 + 주기, 둘 다 없으면 "" */
export const dueDate = (f: FilterItem) => f.nextDate || (f.lastChange ? addDays(f.lastChange, f.cycleDays) : "");
/** 오늘 기준 남은 일수 (음수 = 지연) */
export const daysLeft = (date: string, today = todayStr()) => Math.round((toUTC(date) - toUTC(today)) / DAY);

export type Due = { filter: FilterItem; date: string; left: number };
/** 가장 빠른 교환 예정 필터 */
export function nextDue(c: Customer): Due | null {
  let best: Due | null = null;
  for (const f of c.filters) {
    const date = dueDate(f);
    if (!date) continue;
    const left = daysLeft(date);
    if (!best || left < best.left) best = { filter: f, date, left };
  }
  return best;
}

export const dueLabel = (left: number) => (left < 0 ? `${-left}일 지연` : left === 0 ? "오늘" : `D-${left}`);
export const dueTone = (left: number) =>
  left < 0 ? "bg-red-100 text-red-700" : left <= 14 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700";

export const cycleLabel = (days: number) =>
  days % 365 === 0 ? `${days / 365}년` : days >= 100 && days < 365 ? `약 ${Math.round(days / 30.4)}개월 (${days}일)` : days >= 365 ? `약 ${(days / 365).toFixed(1)}년 (${days}일)` : `${days}일`;

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export const fullAddr = (c: Customer) => `${c.addr1} ${c.addr2}`.trim();
/** 주소2에서 번지를 뺀 나머지 (건물명·동호수) */
const addrDetail = (c: Pick<Customer, "addr2">) => c.addr2.trim().replace(/^(산\s*)?\d+(-\d+)?\s*번?지?/, "").replace(/@/g, " ").replace(/\s+/g, " ").trim();
/** 도로명 주소 + 건물명·동호수. 아직 변환 전이면 빈 문자열 */
export const roadFull = (c: Customer) => (c.roadAddr && c.geoAddr === mapAddress(c) ? `${c.roadAddr} ${addrDetail(c)}`.trim() : "");
export type AddrMode = "jibun" | "road" | "both";
/** 보기 방식에 맞는 주소 한 줄 (도로명이 아직 없으면 지번으로 대신 보여줌) */
export const addrByMode = (c: Customer, mode: AddrMode) => (mode === "road" ? roadFull(c) || fullAddr(c) : fullAddr(c));
export const phones = (c: Customer) => [c.mobile1, c.mobile2, c.tel1, c.tel2].filter(Boolean);
export const firstPhone = (c: Customer) => phones(c)[0] ?? "";

export const emptyCustomer = (): Customer => ({
  id: "", regDate: todayStr(), manager: "", name: "", contactPerson: "", category: "", title: "",
  productNo: "", referrer: "", email: "", zip: "", addr1: "", addr2: "", tel1: "", tel2: "",
  mobile1: "", mobile2: "", note1: "", note2: "", ref1: "", ref2: "", model: "", motor: "",
  memo: "", mgmtType: "CMS", saleType: "판매", monthlyFee: 0, etc: "",
  filters: [
    { name: "세디", cycleDays: 121, lastChange: todayStr() },
    { name: "카본", cycleDays: 121, lastChange: todayStr() },
    { name: "UF", cycleDays: 730, lastChange: todayStr() },
    { name: "외부튜빙", cycleDays: 3650, lastChange: todayStr() },
  ],
});

export function toCSV(list: Customer[]) {
  const head = ["관리번호","등록일자","담당자","고객명","고객정보","우편번호","주소","연락처1","연락처2","휴대폰1","휴대폰2","비고1","비고2","모델명","관리방법","판매구분","월납입액","필터(주기/최근교환/예정)"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = list.map((c) =>
    [c.id, c.regDate, c.manager, c.name, c.contactPerson, c.zip, fullAddr(c), c.roadAddr ?? "", c.tel1, c.tel2, c.mobile1, c.mobile2,
     c.note1, c.note2, c.model, c.mgmtType, c.saleType, c.monthlyFee,
     c.filters.map((f) => `${f.name} ${f.cycleDays}일/${f.lastChange}/${dueDate(f)}`).join(" | ")].map(esc).join(",")
  );
  return "﻿" + [head.map(esc).join(","), ...rows].join("\r\n");
}

// ───────── 지역 ─────────
export type Region = { sido: string; sigungu: string; dong: string };
/** 주소1에서 시도/시·구/동 추출. 예) "경기 안양시 만안구 박달동" → 경기 / 안양시 만안구 / 박달동 */
export function regionOf(c: Pick<Customer, "addr1">): Region {
  const t = c.addr1.trim().split(/\s+/).filter(Boolean);
  if (t.length === 0) return { sido: "", sigungu: "미분류", dong: "" };
  let i = 1;
  let sigungu = t[i] ?? "";
  if (t[i] && /시$/.test(t[i]) && t[i + 1] && /구$/.test(t[i + 1])) { sigungu = `${t[i]} ${t[i + 1]}`; i += 1; }
  return { sido: t[0], sigungu: sigungu || "미분류", dong: t[i + 1] ?? "" };
}

// ───────── 수납 ─────────
export const monthOf = (d: string) => d.slice(0, 7);
export const thisMonth = () => todayStr().slice(0, 7);
export const sumBy = (list: Payment[], kind: Payment["kind"]) => list.filter((p) => p.kind === kind).reduce((s, p) => s + p.amount, 0);
/** 미수금 = 청구 합계 − 수납 합계 (0 미만이면 0) */
export const balanceOf = (list: Payment[]) => Math.max(0, sumBy(list, "청구") - sumBy(list, "수납"));

// ───────── 방문 예정 ─────────
const VISIT_LIKE = ["방문", "AS", "필터교체"];
/** 가장 최근에 정한 방문 예정이 담긴 이력. 완료/취소했거나, 그 뒤에 방문류 이력(또는 예정일 이후 기록)이 있으면 끝난 것으로 본다. */
export function pendingVisitRecord(records: ServiceRecord[]): ServiceRecord | null {
  const r = records.filter((x) => x.nextVisit).sort((a, b) => (b.date + b.nextVisit).localeCompare(a.date + a.nextVisit))[0];
  if (!r || r.visitClosed) return null;
  const done = records.some((x) => x !== r && VISIT_LIKE.includes(x.type) && (x.date > r.date || x.date >= r.nextVisit)); // 통화·메모(상담/방문예약)는 방문으로 치지 않음
  return done ? null : r;
}
export const pendingVisit = (records: ServiceRecord[]): string | null => pendingVisitRecord(records)?.nextVisit ?? null;

// ───────── 지도 ─────────
/** 지도 검색용 주소: 주소1 + 주소2의 번지까지만 (동·호수, 아파트명 제거) */
export function mapAddress(c: Pick<Customer, "addr1" | "addr2">): string {
  const jibun = c.addr2.trim().match(/^(산\s*)?\d+(-\d+)?/)?.[0] ?? "";
  return `${c.addr1.trim()} ${jibun}`.trim();
}
export const hasCoord = (c: Customer) => typeof c.lat === "number" && typeof c.lng === "number" && c.geoAddr === mapAddress(c);

/** 서버에서 저장 전에 누락된 필드를 기본값으로 채움 (API로 일부 필드만 와도 화면이 깨지지 않게) */
export function normalizeCustomer(c: Partial<Customer>): Customer {
  const blank: Customer = {
    id: "", regDate: "", manager: "", name: "", contactPerson: "", category: "", title: "", productNo: "",
    referrer: "", email: "", zip: "", addr1: "", addr2: "", tel1: "", tel2: "", mobile1: "", mobile2: "",
    note1: "", note2: "", ref1: "", ref2: "", model: "", motor: "", memo: "", mgmtType: "", saleType: "",
    monthlyFee: 0, etc: "", filters: [],
  };
  return { ...blank, ...c, filters: Array.isArray(c.filters) ? c.filters : [], monthlyFee: Number(c.monthlyFee) || 0 };
}
