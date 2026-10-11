"use client";
import { useState } from "react";
import type { Customer, FilterItem } from "../lib/types";
import { addDays, cycleLabel, dueDate, todayStr } from "../lib/utils";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="mb-3 text-sm font-semibold text-sky-800">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export default function CustomerForm({
  initial, isNew, onSave, onCancel,
}: { initial: Customer; isNew: boolean; onSave: (c: Customer) => Promise<void>; onCancel: () => void }) {
  const [c, setC] = useState<Customer>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((p) => ({ ...p, [k]: v }));
  const text = (k: keyof Customer, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className={inputCls} value={String(c[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} {...props} />
  );
  const setFilter = (i: number, patch: Partial<FilterItem>) =>
    set("filters", c.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c.name.trim()) return setErr("고객명을 입력해 주세요.");
    setSaving(true); setErr("");
    try { await onSave(c); } catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-100 p-4">
        <Section title="기본 정보">
          <Field label="관리번호 (비우면 자동)">{text("id", { inputMode: "numeric", placeholder: "자동 부여" })}</Field>
          <Field label="등록일자">{text("regDate", { type: "date" })}</Field>
          <Field label="고객명 *" className="col-span-2">{text("name", { placeholder: "예) 홍길동자택", required: true })}</Field>
          <Field label="고객정보 (가족/담당자)">{text("contactPerson")}</Field>
          <Field label="담당자">{text("manager")}</Field>
          <Field label="고객분류">{text("category")}</Field>
          <Field label="소개처">{text("referrer")}</Field>
        </Section>

        <Section title="연락처 · 주소">
          <Field label="휴대폰 1">{text("mobile1", { type: "tel", placeholder: "010-0000-0000" })}</Field>
          <Field label="휴대폰 2">{text("mobile2", { type: "tel" })}</Field>
          <Field label="연락처 1">{text("tel1", { type: "tel" })}</Field>
          <Field label="연락처 2">{text("tel2", { type: "tel" })}</Field>
          <Field label="우편번호">{text("zip")}</Field>
          <Field label="전자메일">{text("email", { type: "email" })}</Field>
          <Field label="주소 1" className="col-span-2">{text("addr1", { placeholder: "경기 군포시 금정동" })}</Field>
          <Field label="주소 2 (상세)" className="col-span-2">{text("addr2")}</Field>
        </Section>

        <Section title="제품 · 계약">
          <Field label="모델명" className="col-span-2">{text("model", { placeholder: "G-7000IW(주기4개월)" })}</Field>
          <Field label="모터명">{text("motor")}</Field>
          <Field label="제품번호">{text("productNo")}</Field>
          <Field label="관리방법">
            <select className={inputCls} value={c.mgmtType} onChange={(e) => set("mgmtType", e.target.value)}>
              {Array.from(new Set(["CMS", "수금", "카드", "자동이체", c.mgmtType].filter(Boolean))).map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="판매구분">
            <select className={inputCls} value={c.saleType} onChange={(e) => set("saleType", e.target.value)}>
              {Array.from(new Set(["판매", "렌탈", c.saleType].filter(Boolean))).map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="월납입액(원)" className="col-span-2">
            <input className={inputCls} type="number" inputMode="numeric" value={c.monthlyFee} onChange={(e) => set("monthlyFee", Number(e.target.value) || 0)} />
          </Field>
        </Section>

        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-800">필터 교환 관리</h3>
            <button type="button" className="rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 active:bg-sky-100"
              onClick={() => set("filters", [...c.filters, { name: "", cycleDays: 121, lastChange: todayStr() }])}>+ 필터 추가</button>
          </div>
          {c.filters.length === 0 && <p className="text-sm text-slate-400">등록된 필터가 없습니다.</p>}
          <div className="space-y-3">
            {c.filters.map((f, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="필터명"><input className={inputCls} value={f.name} onChange={(e) => setFilter(i, { name: e.target.value })} /></Field>
                  <Field label="교환주기(일)">
                    <input className={inputCls} type="number" inputMode="numeric" value={f.cycleDays} onChange={(e) => setFilter(i, { cycleDays: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="최근 교환일"><input className={inputCls} type="date" value={f.lastChange} onChange={(e) => setFilter(i, { lastChange: e.target.value })} /></Field>
                  <div className="flex items-end justify-between gap-2 pb-1">
                    <div className="text-xs text-slate-500">
                      <div>교환예정</div>
                      <div className="text-sm font-semibold text-slate-800">{f.lastChange && f.cycleDays ? dueDate(f) : "-"}</div>
                      <div>{f.cycleDays ? cycleLabel(f.cycleDays) : ""}</div>
                    </div>
                    <button type="button" className="rounded-lg px-2 py-1.5 text-sm text-red-600 active:bg-red-50" onClick={() => set("filters", c.filters.filter((_, j) => j !== i))}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">교환예정일 = 최근 교환일 + 교환주기. 예) 4개월 = 121일, 6개월 = 182일, UF 2년 = 730일</p>
        </section>

        <Section title="메모">
          <Field label="비고/약도 1" className="col-span-2"><textarea className={inputCls} rows={2} value={c.note1} onChange={(e) => set("note1", e.target.value)} /></Field>
          <Field label="비고/약도 2" className="col-span-2"><textarea className={inputCls} rows={2} value={c.note2} onChange={(e) => set("note2", e.target.value)} /></Field>
          <Field label="참고내용 1"><textarea className={inputCls} rows={2} value={c.ref1} onChange={(e) => set("ref1", e.target.value)} /></Field>
          <Field label="참고내용 2"><textarea className={inputCls} rows={2} value={c.ref2} onChange={(e) => set("ref2", e.target.value)} /></Field>
          <Field label="메모사항" className="col-span-2"><textarea className={inputCls} rows={3} value={c.memo} onChange={(e) => set("memo", e.target.value)} /></Field>
        </Section>
      </div>

      <div className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700 active:bg-slate-50">취소</button>
          <button type="submit" disabled={saving} className="flex-[2] rounded-xl bg-sky-700 py-3 font-semibold text-white active:bg-sky-800 disabled:opacity-60">
            {saving ? "저장 중…" : isNew ? "등록하기" : "저장하기"}
          </button>
        </div>
      </div>
    </form>
  );
}
