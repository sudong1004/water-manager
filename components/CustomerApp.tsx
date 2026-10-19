"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Customer, Payment, ServiceRecord } from "../lib/types";
import { balanceOf, emptyCustomer, todayStr } from "../lib/utils";
import { api } from "../lib/api";
import { USE_SUPABASE } from "../lib/supabase/env";
import { browserClient } from "../lib/supabase/client";
import CustomerForm from "./CustomerForm";
import CustomerDetail from "./CustomerDetail";
import DashboardView from "./DashboardView";
import CustomersView from "./CustomersView";
import PaymentsView from "./PaymentsView";
import ImportView from "./ImportView";
import MapView from "./MapView";
import CalendarView from "./CalendarView";

type Tab = "home" | "customers" | "map" | "calendar" | "payments" | "import";
type Mode = { type: "view"; id: string } | { type: "edit"; id: string } | { type: "new" } | null;

const TABS: { k: Tab; icon: string; label: string }[] = [
  { k: "home", icon: "🏠", label: "홈" },
  { k: "customers", icon: "👥", label: "고객" },
  { k: "map", icon: "🗺", label: "지도" },
  { k: "calendar", icon: "📅", label: "달력" },
  { k: "payments", icon: "💰", label: "수납" },
];

export default function CustomerApp() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const [seg, setSeg] = useState<"all" | "overdue">("all");
  const [segKey, setSegKey] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [toast, setToast] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (USE_SUPABASE) browserClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  async function logout() {
    await browserClient().auth.signOut();
    window.location.href = "/login";
  }

  const load = useCallback(async () => {
    const [c, p, r] = await Promise.all([api("/api/customers"), api("/api/payments"), api("/api/records")]);
    setCustomers(c); setPayments(p); setRecords(r);
  }, []);
  useEffect(() => { load().catch((e) => setToast(e.message)); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => {
    document.body.style.overflow = mode ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mode]);

  const list = customers ?? [];
  const balances = useMemo(() => {
    const by = new Map<string, Payment[]>();
    payments.forEach((p) => by.set(p.customerId, [...(by.get(p.customerId) ?? []), p]));
    return new Map(list.map((c) => [c.id, balanceOf(by.get(c.id) ?? [])]));
  }, [list, payments]);

  const current = mode && mode.type !== "new" ? list.find((c) => c.id === mode.id) : undefined;
  const open = (id: string) => setMode({ type: "view", id });

  async function save(c: Customer) {
    if (mode?.type === "new") {
      const created: Customer = await api("/api/customers", { method: "POST", body: JSON.stringify(c) });
      setToast("신규 고객이 등록되었습니다."); await load(); setMode({ type: "view", id: created.id });
    } else if (mode?.type === "edit") {
      const updated: Customer = await api(`/api/customers/${encodeURIComponent(mode.id)}`, { method: "PUT", body: JSON.stringify(c) });
      setToast("저장되었습니다."); await load(); setMode({ type: "view", id: updated.id });
    }
  }
  /** 필터 교환 완료: 선택한 날짜로 교환일 갱신 + 방문 이력(필터교체) 기록 (필터 정보 연결) */
  async function replaceFilters(c: Customer, idx: number[], date: string) {
    const targets = idx.filter((i) => c.filters[i] && c.filters[i].lastChange < date);
    if (!targets.length) { setToast("이미 같은 날짜 이후에 교환 기록이 있습니다."); return; }
    const names = targets.map((i) => c.filters[i].name);
    const next = { ...c, filters: c.filters.map((f, j) => (targets.includes(j) ? { ...f, lastChange: date } : f)) };
    await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify(next) });
    await api("/api/records", { method: "POST", body: JSON.stringify({
      customerId: c.id, date, type: "필터교체", content: `${names.join(", ")} 교체`, nextVisit: "",
      filters: targets.map((i) => ({ name: c.filters[i].name, prev: c.filters[i].lastChange })),
    }) });
    setToast(`${names.join(", ")} 교환 완료 (${date}) · 이력에 기록됨`); await load();
  }
  /** 이력(필터교체)을 추가·수정·삭제했을 때 필터의 최근 교환일을 이력 기준으로 다시 맞춤 */
  async function syncFilters(customerId: string, old?: ServiceRecord, savedId?: string) {
    const [cs, rs]: [Customer[], ServiceRecord[]] = await Promise.all([api("/api/customers"), api("/api/records")]);
    const c = cs.find((x) => x.id === customerId);
    if (!c) return;
    const mine = rs.filter((r) => r.customerId === customerId && r.type === "필터교체");
    const namesOf = (r?: ServiceRecord) =>
      !r || r.type !== "필터교체" ? [] : r.filters?.length ? r.filters.map((f) => f.name) : c.filters.filter((f) => r.content?.includes(f.name)).map((f) => f.name);
    const saved = savedId ? rs.find((r) => r.id === savedId) : undefined;
    const affected = new Set([...namesOf(old), ...namesOf(saved)]);
    let changed = false;
    const filters = c.filters.map((f) => {
      if (!affected.has(f.name)) return f;
      const dates = mine.filter((r) => namesOf(r).includes(f.name)).map((r) => r.date);
      const prev = old?.filters?.find((x) => x.name === f.name)?.prev;
      const last = dates.length ? dates.sort().at(-1)! : prev ?? f.lastChange;
      if (last === f.lastChange) return f;
      changed = true;
      return { ...f, lastChange: last };
    });
    if (changed) {
      await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify({ ...c, filters }) });
      setToast("이력 기준으로 필터 교환일도 함께 수정했습니다.");
    }
  }
  async function remove(c: Customer) {
    if (!confirm(`"${c.name}" 고객을 삭제할까요?\n수납·이력 기록도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "DELETE" });
    setToast("삭제되었습니다."); setMode(null); await load();
  }
  function go(t: "customers" | "payments", f?: string) {
    if (t === "customers") { setSeg(f === "overdue" ? "overdue" : "all"); setSegKey((k) => k + 1); }
    setTab(t);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl pb-28 sm:pb-10">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h1 className="min-w-0 truncate text-base font-bold text-sky-800 sm:text-lg">💧 정수기 고객관리</h1>
          <nav className="hidden gap-1 sm:flex">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${(tab === "import" ? "customers" : tab) === t.k ? "bg-sky-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.icon} {t.label}</button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {USE_SUPABASE && (
              <button onClick={logout} title={email} className="whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-600 active:bg-slate-50">로그아웃</button>
            )}
          </div>
        </div>
      </header>

      {customers === null ? (
        <p className="py-24 text-center text-slate-400">불러오는 중…</p>
      ) : (
        <main>
          {tab === "home" && <DashboardView customers={list} payments={payments} records={records} open={open} go={go} />}
          {tab === "customers" && <CustomersView key={segKey} customers={list} balances={balances} records={records} initialSeg={seg} open={open} onImport={() => setTab("import")} onNew={() => setMode({ type: "new" })} />}
          {tab === "map" && <MapView customers={list} balances={balances} open={open} reload={load} notify={setToast} />}
          {tab === "calendar" && <CalendarView customers={list} payments={payments} records={records} open={open} reload={load} notify={setToast} />}
          {tab === "payments" && <PaymentsView customers={list} payments={payments} open={open} />}
          {tab === "import" && <ImportView reload={load} notify={setToast} />}
        </main>
      )}

      {/* 모바일 하단 메뉴 */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${(tab === "import" ? "customers" : tab) === t.k ? "text-sky-700" : "text-slate-400"}`}>
            <span className="text-xl leading-none">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      {mode && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/50" onClick={() => setMode(null)}>
          <div className="flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="truncate text-base font-bold">{mode.type === "new" ? "신규 고객 등록" : mode.type === "edit" ? "고객 정보 수정" : current?.name}</h2>
              <button onClick={() => setMode(null)} className="rounded-lg px-3 py-1.5 text-slate-500 active:bg-slate-100" aria-label="닫기">✕</button>
            </div>
            <div className="min-h-0 flex-1">
              {mode.type === "new" && <CustomerForm key="new" isNew initial={emptyCustomer()} onSave={save} onCancel={() => setMode(null)} />}
              {mode.type === "edit" && current && <CustomerForm key={current.id} isNew={false} initial={current} onSave={save} onCancel={() => setMode({ type: "view", id: current.id })} />}
              {mode.type === "view" && current && (
                <CustomerDetail key={current.id} c={current}
                  payments={payments.filter((p) => p.customerId === current.id)}
                  records={records.filter((r) => r.customerId === current.id)}
                  reload={load} notify={setToast} onRecordChange={syncFilters}
                  onEdit={() => setMode({ type: "edit", id: current.id })}
                  onDelete={() => remove(current)}
                  onReplace={(idx, date) => replaceFilters(current, idx, date)} />
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg sm:bottom-8">{toast}</div>}
    </div>
  );
}
