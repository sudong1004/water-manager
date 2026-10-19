"use client";
import { useMemo, useState } from "react";
import type { Customer, Payment, ServiceRecord } from "../lib/types";
import { RECORD_TYPES } from "../lib/types";
import { dueDate, pendingVisit, todayStr, addDays, won } from "../lib/utils";
import { buildWorkItems, monthEnd, monthStart, TYPE_ICON, type WorkItem } from "../lib/worklog";
import { api } from "../lib/api";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const ALL_TYPES = [...RECORD_TYPES, "수납", "청구"] as string[];

function dayTitle(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  return `${m}월 ${dd}일 (${WEEK[new Date(y, m - 1, dd).getDay()]})`;
}

export default function CalendarView({
  customers, payments, records, open, reload, notify,
}: {
  customers: Customer[]; payments: Payment[]; records: ServiceRecord[];
  open: (id: string) => void; reload: () => Promise<void>; notify: (m: string) => void;
}) {
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [sel, setSel] = useState(today);
  const items = useMemo(() => buildWorkItems(customers, payments, records), [customers, payments, records]);

  // ── 날짜별 집계 (한 일 / 예정)
  const doneBy = useMemo(() => {
    const m = new Map<string, WorkItem[]>();
    items.forEach((it) => m.set(it.date, [...(m.get(it.date) ?? []), it]));
    return m;
  }, [items]);
  const plannedBy = useMemo(() => {
    const m = new Map<string, { id: string; name: string; text: string }[]>();
    const add = (d: string, v: { id: string; name: string; text: string }) => m.set(d, [...(m.get(d) ?? []), v]);
    const recBy = new Map<string, ServiceRecord[]>();
    records.forEach((r) => recBy.set(r.customerId, [...(recBy.get(r.customerId) ?? []), r]));
    customers.forEach((c) => {
      const byDate = new Map<string, string[]>();
      c.filters.forEach((f) => { if (f.lastChange) { const d = dueDate(f); byDate.set(d, [...(byDate.get(d) ?? []), f.name]); } });
      byDate.forEach((names, d) => add(d, { id: c.id, name: c.name, text: `${names.join(", ")} 교환 예정` }));
      const v = pendingVisit(recBy.get(c.id) ?? []);
      if (v) add(v, { id: c.id, name: c.name, text: "방문 예정" });
    });
    return m;
  }, [customers, records]);

  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1).getDay();
  const days = new Date(y, mo, 0).getDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  const shift = (n: number) => { const d = new Date(y, mo - 1 + n, 1); setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };

  const dayDone = doneBy.get(sel) ?? [];
  const dayPlan = plannedBy.get(sel) ?? [];

  // ── 기간 보고서
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [types, setTypes] = useState<string[]>(ALL_TYPES);
  const [onlyNew, setOnlyNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const range = useMemo(
    () => items.filter((it) => it.date >= from && it.date <= to && types.includes(it.type) && (!onlyNew || !it.entered)).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "ko")),
    [items, from, to, types, onlyNew],
  );
  const counts = useMemo(() => { const m = new Map<string, number>(); range.forEach((it) => m.set(it.type, (m.get(it.type) ?? 0) + 1)); return m; }, [range]);
  const sumIn = range.filter((i) => i.type === "수납").reduce((s, i) => s + i.amount, 0);
  const preset = (a: string, b: string) => { setFrom(a); setTo(b); };
  const setWeek = () => { const d = new Date(); const sun = addDays(today, -d.getDay()); preset(sun, today); };
  const lastMonth = () => { const d = new Date(y0(), m0() - 2, 1); const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; preset(k, monthEnd(k)); };
  function y0() { return Number(today.slice(0, 4)); }
  function m0() { return Number(today.slice(5, 7)); }
  const toggleType = (t: string) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const label = `${from} ~ ${to}`;
  const fileBase = `업무내역_${from}_${to}`;

  async function downloadXlsx() {
    if (!range.length) return notify("내보낼 내역이 없습니다.");
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const sheet = (rows: Record<string, string | number>[], widths: number[]) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = widths.map((wch) => ({ wch }));
      return ws;
    };
    XLSX.utils.book_append_sheet(wb, sheet(range.map((i) => ({
      날짜: i.date, 구분: i.type, 관리번호: i.customerId, 고객명: i.name, 주소: i.addr, 도로명주소: i.road,
      내용: i.filters.length ? `${i.filters.join(", ")} 교체${i.content && !i.content.endsWith("교체") ? " / " + i.content : ""}` : i.content,
      금액: i.amount || "", 결제방법: i.method, "PC입력": i.entered ? "완료" : "",
    })), [11, 9, 9, 16, 34, 34, 36, 11, 10, 8]), "전체 내역");
    const fl = range.filter((i) => i.type === "필터교체");
    if (fl.length) {
      const rows: Record<string, string | number>[] = [];
      fl.forEach((i) => (i.filters.length ? i.filters : [""]).forEach((f) => rows.push({ 교환일: i.date, 관리번호: i.customerId, 고객명: i.name, 필터명: f, 비고: f ? "" : i.content })));
      XLSX.utils.book_append_sheet(wb, sheet(rows, [11, 9, 16, 12, 30]), "필터교환(PC입력용)");
    }
    const pay = range.filter((i) => i.type === "수납" || i.type === "청구");
    if (pay.length) {
      XLSX.utils.book_append_sheet(wb, sheet(pay.map((i) => ({ 날짜: i.date, 관리번호: i.customerId, 고객명: i.name, 구분: i.type, 금액: i.amount, 결제방법: i.method, 메모: i.content })), [11, 9, 16, 7, 11, 10, 30]), "수납(PC입력용)");
    }
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
    notify("엑셀 파일을 저장했습니다.");
  }

  function printDoc() {
    if (!range.length) return notify("인쇄할 내역이 없습니다.");
    const w = window.open("", "_blank");
    if (!w) return notify("팝업이 차단되었습니다. 팝업을 허용하거나 엑셀로 저장해 주세요.");
    const body = range.map((i) => {
      const what = i.filters.length ? `${i.filters.join(", ")} 교체${i.content && !i.content.endsWith("교체") ? " / " + i.content : ""}` : i.content;
      return `<tr><td>${i.date.slice(5)}</td><td>${esc(i.type)}</td><td>${esc(i.customerId)}</td><td>${esc(i.name)}</td><td>${esc(i.addr)}</td><td>${esc(what)}</td><td class="r">${i.amount ? i.amount.toLocaleString() : ""}</td></tr>`;
    }).join("");
    const summary = Array.from(counts.entries()).map(([k, v]) => `${k} ${v}건`).join(" · ");
    w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(fileBase)}</title><style>
      body{font-family:-apple-system,'Malgun Gothic',sans-serif;margin:16px;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:2px 0 10px;font-size:12px;color:#555}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:4px 5px;text-align:left;vertical-align:top}th{background:#eef2f7}.r{text-align:right;white-space:nowrap}
      @media print{@page{size:A4 landscape;margin:10mm}}</style></head><body>
      <h1>업무 내역 · ${esc(label)}</h1><p>${esc(summary)}${sumIn ? ` · 수납 합계 ${sumIn.toLocaleString()}원` : ""} · 출력일 ${today}</p>
      <table><thead><tr><th>날짜</th><th>구분</th><th>관리번호</th><th>고객명</th><th>주소</th><th>내용</th><th>금액</th></tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }

  async function copyText() {
    if (!range.length) return notify("복사할 내역이 없습니다.");
    const lines = range.map((i) => `${i.date.slice(5)} [${i.type}] ${i.customerId} ${i.name} ${i.filters.length ? i.filters.join(",") + " 교체" : i.content}${i.amount ? " " + won(i.amount) : ""}`.trim());
    try { await navigator.clipboard.writeText(`업무 내역 ${label}\n` + lines.join("\n")); notify("텍스트로 복사했습니다."); } catch { notify("복사하지 못했습니다."); }
  }

  async function markEntered(value: boolean) {
    const targets = range.filter((i) => i.entered !== value);
    if (!targets.length) return notify(value ? "이미 모두 입력 완료로 표시되어 있습니다." : "바꿀 항목이 없습니다.");
    if (!confirm(`이 기간 ${targets.length}건을 "PC 입력 ${value ? "완료" : "안 함"}"으로 표시할까요?`)) return;
    setBusy(true);
    try {
      const rById = new Map(records.map((r) => [r.id, r]));
      const pById = new Map(payments.map((p) => [p.id, p]));
      await Promise.all(targets.map((i) => i.kind === "record"
        ? api(`/api/records/${i.id}`, { method: "PUT", body: JSON.stringify({ ...rById.get(i.id), entered: value }) })
        : api(`/api/payments/${i.id}`, { method: "PUT", body: JSON.stringify({ ...pById.get(i.id), entered: value }) })));
      await reload(); notify(`${targets.length}건을 PC 입력 ${value ? "완료" : "안 함"}으로 표시했습니다.`);
    } catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, WorkItem[]>();
    range.slice(0, 120).forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    return Array.from(m.entries());
  }, [range]);

  const btn = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50";
  const inp = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-4 px-4 pt-3">
      {/* 달력 */}
      <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => shift(-1)} className="rounded-lg px-3 py-2 text-lg text-slate-600 active:bg-slate-100" aria-label="이전 달">‹</button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-sky-800">{y}년 {mo}월</h2>
            <button onClick={() => { setMonth(today.slice(0, 7)); setSel(today); }} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">오늘</button>
          </div>
          <button onClick={() => shift(1)} className="rounded-lg px-3 py-2 text-lg text-slate-600 active:bg-slate-100" aria-label="다음 달">›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
          {WEEK.map((w, i) => <div key={w} className={`py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : ""}`}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const done = doneBy.get(d)?.length ?? 0;
            const plan = plannedBy.get(d)?.length ?? 0;
            const isSel = d === sel;
            return (
              <button key={d} data-day={d} onClick={() => setSel(d)}
                className={`flex h-14 flex-col items-center rounded-lg pt-1.5 text-sm ${isSel ? "bg-sky-700 text-white" : d === today ? "bg-sky-50 font-bold text-sky-800 ring-1 ring-sky-300" : "text-slate-700 active:bg-slate-100"}`}>
                <span>{Number(d.slice(8))}</span>
                <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold leading-none">
                  {done > 0 && <span className={`rounded-full px-1 py-0.5 ${isSel ? "bg-white text-sky-700" : "bg-sky-100 text-sky-700"}`}>{done}</span>}
                  {plan > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-amber-200" : "bg-amber-500"}`} />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400"><span className="rounded-full bg-sky-100 px-1.5 font-bold text-sky-700">N</span> 한 일 · <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> 예정(필터 교환·방문)</p>
      </section>

      {/* 선택한 날 */}
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-sm font-bold text-sky-800">{dayTitle(sel)} {sel === today && <span className="ml-1 text-xs font-medium text-slate-400">오늘</span>}</h3>
        {dayDone.length === 0 && dayPlan.length === 0 && <p className="py-6 text-center text-sm text-slate-400">이 날의 기록이 없습니다.</p>}
        {dayDone.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100">
            {dayDone.map((it) => (
              <li key={it.key}>
                <button onClick={() => open(it.customerId)} className="flex w-full items-start gap-2.5 py-2.5 text-left">
                  <span className="text-lg leading-none">{TYPE_ICON[it.type] ?? "📝"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 text-sm"><b>{it.name}</b><span className="text-xs text-slate-400">No.{it.customerId}</span><span className="rounded bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">{it.type}</span>
                      {it.entered && <span className="text-xs font-semibold text-emerald-600">✔ PC입력</span>}</span>
                    <span className="mt-0.5 block break-words text-sm text-slate-600">
                      {it.filters.length > 0 ? `${it.filters.join(", ")} 교체` : it.content || (it.amount > 0 ? "" : "-")}
                      {it.amount > 0 && <b className={`ml-1.5 ${it.type === "청구" ? "text-red-600" : "text-emerald-700"}`}>{won(it.amount)}{it.method ? ` · ${it.method}` : ""}</b>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {dayPlan.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3">
            <div className="mb-1 text-xs font-bold text-amber-800">📅 예정 {dayPlan.length}건</div>
            <ul className="divide-y divide-amber-100">
              {dayPlan.map((p, i) => (
                <li key={p.id + i}><button onClick={() => open(p.id)} className="flex w-full justify-between gap-2 py-1.5 text-left text-sm"><b>{p.name}</b><span className="text-amber-800">{p.text}</span></button></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 기간 보고서 */}
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-sm font-bold text-sky-800">📄 기간별 업무 내역 · 문서로 저장</h3>
        <p className="mt-0.5 text-xs text-slate-500">기간을 정해 내가 한 일을 엑셀·인쇄(PDF)로 뽑아 PC 프로그램에 입력할 때 쓰세요.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs text-slate-500">시작일</span><input type="date" className={inp + " w-full"} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs text-slate-500">종료일</span><input type="date" className={inp + " w-full"} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {([["오늘", () => preset(today, today)], ["이번 주", setWeek], ["이번 달", () => preset(monthStart(today), today)], ["지난 달", lastMonth], ["최근 7일", () => preset(addDays(today, -6), today)], ["최근 30일", () => preset(addDays(today, -29), today)]] as [string, () => void][]).map(([l, f]) => (
            <button key={l} onClick={f} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-200">{l}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_TYPES.map((t) => (
            <button key={t} onClick={() => toggleType(t)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${types.includes(t) ? "bg-sky-700 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>{TYPE_ICON[t]} {t}</button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="h-4 w-4" /> PC에 아직 입력 안 한 것만</label>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <b>{range.length}건</b>
          <span className="ml-2 text-slate-500">{Array.from(counts.entries()).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>
          {sumIn > 0 && <span className="ml-2 font-semibold text-emerald-700">수납 {won(sumIn)}</span>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={downloadXlsx} className={btn + " !bg-emerald-600 !text-white !border-emerald-600"}>📊 엑셀 저장</button>
          <button onClick={printDoc} className={btn}>🖨 인쇄 · PDF</button>
          <button onClick={copyText} className={btn}>📋 텍스트 복사</button>
          <button onClick={() => markEntered(true)} disabled={busy} className={btn}>✔ PC 입력 완료 표시</button>
        </div>
        {range.some((i) => i.entered) && <button onClick={() => markEntered(false)} disabled={busy} className="mt-2 text-xs text-slate-400 underline">입력 완료 표시 해제</button>}

        {grouped.length > 0 && (
          <div className="mt-4 space-y-3">
            {grouped.map(([d, list]) => (
              <div key={d}>
                <div className="mb-1 text-xs font-bold text-slate-500">{dayTitle(d)}</div>
                <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-100">
                  {list.map((it) => (
                    <li key={it.key} className="flex items-start gap-2 px-3 py-2 text-sm">
                      <span>{TYPE_ICON[it.type] ?? "📝"}</span>
                      <span className="min-w-0 flex-1"><b>{it.name}</b> <span className="text-xs text-slate-400">No.{it.customerId}</span>
                        <span className="block break-words text-slate-600">{it.filters.length ? `${it.filters.join(", ")} 교체` : it.content || it.type}{it.amount > 0 && ` · ${won(it.amount)}`}</span></span>
                      {it.entered && <span className="shrink-0 text-xs font-semibold text-emerald-600">✔</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {range.length > 120 && <p className="text-center text-xs text-slate-400">미리보기는 120건까지 · 엑셀·인쇄에는 전체 {range.length}건이 포함됩니다.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
