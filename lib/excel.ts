import * as XLSX from "xlsx";
import type { Customer, FilterItem } from "./types";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const phone = (v: unknown) => {
  const t = s(v).replace(/\s+/g, "");
  return /^\d*-?$/.test(t) ? "" : t; // '02-', '01-' 같은 빈 값 제거
};
const date = (v: unknown) => {
  const t = s(v).replace(/[./]/g, "-");
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
};
const num = (v: unknown) => parseInt(s(v).replace(/,/g, ""), 10) || 0;

export type ParseResult = { customers: Customer[]; errors: { row: number; message: string }[]; missingHeaders: string[] };

const REQUIRED = ["관리번호", "고객명"];

export function parseWorkbook(buf: Buffer): ParseResult {
  const wb = XLSX.read(buf, { type: "buffer", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const errors: ParseResult["errors"] = [];
  if (rows.length === 0) return { customers: [], errors, missingHeaders: REQUIRED };

  // 헤더의 공백 제거: '담 당 자' -> '담당자'
  const H: Record<string, number> = {};
  rows[0].forEach((h, i) => (H[s(h).replace(/\s+/g, "")] = i));
  const missingHeaders = REQUIRED.filter((h) => !(h in H));
  if (missingHeaders.length) return { customers: [], errors, missingHeaders };

  const g = (r: unknown[], k: string) => (k in H ? r[H[k]] : "");
  const customers: Customer[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((r, idx) => {
    const row = idx + 2;
    if (r.every((v) => !s(v))) return;
    const id = s(g(r, "관리번호"));
    const name = s(g(r, "고객명"));
    if (!id) return errors.push({ row, message: "관리번호가 없습니다." });
    if (!name) return errors.push({ row, message: `관리번호 ${id}: 고객명이 없습니다.` });
    if (seen.has(id)) return errors.push({ row, message: `관리번호 ${id}가 파일 안에서 중복되었습니다.` });
    seen.add(id);

    const filters: FilterItem[] = [];
    for (let n = 1; n <= 9; n++) {
      const fname = s(g(r, `필터명${n}/9`));
      const cyc = num(g(r, `주기${n}/9`));
      const last = date(g(r, `최근교환${n}/9`));
      if (fname && cyc > 0 && last) filters.push({ name: fname, cycleDays: cyc, lastChange: last });
    }
    customers.push({
      id, regDate: date(g(r, "등록일자")), manager: s(g(r, "담당자")), name,
      contactPerson: s(g(r, "고객정보")), category: s(g(r, "고객분류")), title: s(g(r, "고객호칭")),
      productNo: s(g(r, "제품번호")), referrer: s(g(r, "소개처")), email: s(g(r, "전자메일")),
      zip: s(g(r, "우편번호")), addr1: s(g(r, "고객주소(1)")), addr2: s(g(r, "고객주소(2)")),
      tel1: phone(g(r, "연락처(1)")), tel2: phone(g(r, "연락처(2)")),
      mobile1: phone(g(r, "휴대폰(1)")), mobile2: phone(g(r, "휴대폰(2)")),
      note1: s(g(r, "약도설명1/2")), note2: s(g(r, "약도설명2/2")),
      ref1: s(g(r, "참고내용1/2")), ref2: s(g(r, "참고내용2/2")),
      model: s(g(r, "모델명")), motor: s(g(r, "모터명")),
      memo: [s(g(r, "메모사항")), s(g(r, "메모장"))].filter(Boolean).join(" "),
      mgmtType: s(g(r, "관리방법")), saleType: s(g(r, "판매구분")),
      monthlyFee: num(g(r, "월납입액")), etc: s(g(r, "기타사항")), filters,
    });
  });
  return { customers, errors, missingHeaders };
}

/** 가져오기에서 엑셀 값으로 갱신하는 항목(= 엑셀이 원천인 항목) */
export const IMPORT_FIELDS: (keyof Customer)[] = [
  "regDate", "manager", "name", "contactPerson", "category", "title", "productNo", "referrer", "email",
  "zip", "addr1", "addr2", "tel1", "tel2", "mobile1", "mobile2", "note1", "note2", "ref1", "ref2",
  "model", "motor", "memo", "mgmtType", "saleType", "monthlyFee", "etc",
];

export const FIELD_LABEL: Partial<Record<keyof Customer, string>> = {
  regDate: "등록일", manager: "담당자", name: "고객명", contactPerson: "고객정보", category: "분류", title: "호칭",
  productNo: "제품번호", referrer: "소개처", email: "메일", zip: "우편번호", addr1: "주소1", addr2: "주소2",
  tel1: "연락처1", tel2: "연락처2", mobile1: "휴대폰1", mobile2: "휴대폰2", note1: "비고1", note2: "비고2",
  ref1: "참고1", ref2: "참고2", model: "모델", motor: "모터", memo: "메모", mgmtType: "관리방법",
  saleType: "판매구분", monthlyFee: "월납입액", etc: "기타", filters: "필터",
};

/**
 * 기존 고객과 엑셀 행을 병합.
 * - 엑셀이 원천인 항목은 엑셀 값으로 갱신하되, 엑셀에서 비어 있는 값은 기존 값을 지우지 않음
 * - 필터: 엑셀 주기를 반영하고, 최근 교환일은 더 최근 값을 유지(앱에서 교환 완료 처리한 기록 보존)
 */
export function mergeCustomer(old: Customer, inc: Customer): { merged: Customer; changed: string[] } {
  const merged: Customer = { ...old };
  const changed: string[] = [];
  for (const k of IMPORT_FIELDS) {
    const nv = inc[k];
    if (nv === "" || nv === undefined) continue;
    if (nv !== old[k]) {
      (merged as Record<string, unknown>)[k] = nv;
      changed.push(FIELD_LABEL[k] ?? k);
    }
  }
  const filters = [...old.filters.map((f) => ({ ...f }))];
  let fChanged = false;
  for (const nf of inc.filters) {
    const i = filters.findIndex((f) => f.name === nf.name);
    if (i < 0) { filters.push({ ...nf }); fChanged = true; continue; }
    const o = filters[i];
    const last = nf.lastChange > o.lastChange ? nf.lastChange : o.lastChange;
    if (o.cycleDays !== nf.cycleDays || o.lastChange !== last) {
      filters[i] = { name: o.name, cycleDays: nf.cycleDays, lastChange: last, ...(last === o.lastChange && o.nextDate ? { nextDate: o.nextDate } : {}) };
      fChanged = true;
    }
  }
  if (fChanged) { merged.filters = filters; changed.push("필터"); }
  return { merged, changed };
}
