import { randomUUID } from "crypto";
import { readAll, mutate } from "./store";
import { USE_SUPABASE } from "./supabase/env";
import { serverClient } from "./supabase/server";
import type { Customer, ImportLog, Payment, ServiceRecord } from "./types";

export class DuplicateError extends Error {}

/** 컬렉션 하나를 다루는 저장소. 파일/Supabase 두 구현이 같은 인터페이스를 따른다. */
export interface Repo<T extends { id: string }> {
  list(): Promise<T[]>;
  ids(): Promise<string[]>; // id만 (관리번호 매기기처럼 본문이 필요 없을 때 가볍게)
  get(id: string): Promise<T | null>;
  insert(row: T): Promise<void>; // 같은 id가 있으면 DuplicateError
  update(id: string, row: T): Promise<boolean>; // id 변경 가능. 없으면 false
  remove(id: string): Promise<void>;
  upsertMany(rows: T[]): Promise<void>; // 있으면 갱신, 없으면 앞쪽에 추가
  // 고객별 하위 기록(수납/이력)용
  removeByCustomer(customerId: string): Promise<void>;
  reassignCustomer(oldId: string, newId: string): Promise<void>;
}

// ───────── 파일 구현 ─────────
function fileRepo<T extends { id: string; customerId?: string }>(name: string, keep?: number): Repo<T> {
  return {
    list: () => readAll<T>(name),
    ids: async () => (await readAll<T>(name)).map((r) => r.id),
    get: async (id) => (await readAll<T>(name)).find((r) => r.id === id) ?? null,
    insert: (row) =>
      mutate<T, void>(name, (l) => {
        if (l.some((r) => r.id === row.id)) throw new DuplicateError("이미 사용 중인 관리번호입니다.");
        const next = [row, ...l];
        return { list: keep ? next.slice(0, keep) : next, result: undefined };
      }),
    update: (id, row) =>
      mutate<T, boolean>(name, (l) => {
        const i = l.findIndex((r) => r.id === id);
        if (i < 0) return { list: l, result: false };
        if (row.id !== id && l.some((r) => r.id === row.id)) throw new DuplicateError("이미 사용 중인 관리번호입니다.");
        const next = [...l];
        next[i] = row;
        return { list: next, result: true };
      }),
    remove: (id) => mutate<T, void>(name, (l) => ({ list: l.filter((r) => r.id !== id), result: undefined })),
    upsertMany: (rows) =>
      mutate<T, void>(name, (l) => {
        const byId = new Map(rows.map((r) => [r.id, r]));
        const existing = new Set(l.map((r) => r.id));
        const fresh = rows.filter((r) => !existing.has(r.id));
        return { list: [...fresh, ...l.map((r) => byId.get(r.id) ?? r)], result: undefined };
      }),
    removeByCustomer: (cid) => mutate<T, void>(name, (l) => ({ list: l.filter((r) => r.customerId !== cid), result: undefined })),
    reassignCustomer: (a, b) =>
      mutate<T, void>(name, (l) => ({ list: l.map((r) => (r.customerId === a ? { ...r, customerId: b } : r)), result: undefined })),
  };
}

// ───────── Supabase 구현 (테이블: owner_id, id, [customer_id], data jsonb) ─────────
type SB = Awaited<ReturnType<typeof serverClient>>;
const fail = (e: { message: string; code?: string } | null) => {
  if (!e) return;
  if (e.code === "23505") throw new DuplicateError("이미 사용 중인 관리번호입니다.");
  throw new Error(e.message);
};

// conflict: upsert 충돌 기준 (customers는 기본키가 (owner_id,id), 나머지는 id)
function sbRepo<T extends { id: string; customerId?: string }>(sb: SB, table: string, hasCustomer: boolean, conflict = "id"): Repo<T> {
  const cols = (row: T) => ({ id: row.id, data: row, ...(hasCustomer ? { customer_id: row.customerId } : {}) });
  return {
    async list() {
      const out: T[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from(table).select("data").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
        fail(error);
        out.push(...(data ?? []).map((r) => r.data as T));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async ids() {
      const out: string[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from(table).select("id").order("id").range(from, from + 999);
        fail(error);
        out.push(...(data ?? []).map((r) => r.id as string));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async get(id) {
      const { data, error } = await sb.from(table).select("data").eq("id", id).maybeSingle();
      fail(error);
      return (data?.data as T) ?? null;
    },
    async insert(row) {
      const { error } = await sb.from(table).insert(cols(row));
      fail(error);
    },
    async update(id, row) {
      const { data, error } = await sb.from(table).update(cols(row)).eq("id", id).select("id");
      fail(error);
      return (data?.length ?? 0) > 0;
    },
    async remove(id) {
      const { error } = await sb.from(table).delete().eq("id", id);
      fail(error);
    },
    async upsertMany(rows) {
      if (!rows.length) return;
      for (let i = 0; i < rows.length; i += 200) {
        // owner_id는 DB 기본값(auth.uid())으로 채워지고, 기본키 충돌 시 갱신
        const { error } = await sb.from(table).upsert(rows.slice(i, i + 200).map(cols), { onConflict: conflict });
        fail(error);
      }
    },
    async removeByCustomer(cid) {
      const { error } = await sb.from(table).delete().eq("customer_id", cid);
      fail(error);
    },
    async reassignCustomer(a, b) {
      const { data, error } = await sb.from(table).select("id,data").eq("customer_id", a);
      fail(error);
      for (const r of data ?? []) {
        const { error: e2 } = await sb.from(table).update({ customer_id: b, data: { ...(r.data as T), customerId: b } }).eq("id", r.id);
        fail(e2);
      }
    },
  };
}

export type Repos = { customers: Repo<Customer>; payments: Repo<Payment>; records: Repo<ServiceRecord>; imports: Repo<ImportLog> };

export async function getRepos(): Promise<Repos> {
  if (!USE_SUPABASE) {
    return {
      customers: fileRepo<Customer>("customers"),
      payments: fileRepo<Payment>("payments"),
      records: fileRepo<ServiceRecord>("records"),
      imports: fileRepo<ImportLog>("imports", 100),
    };
  }
  const sb = await serverClient();
  return {
    customers: sbRepo<Customer>(sb, "customers", false, "owner_id,id"),
    payments: sbRepo<Payment>(sb, "payments", true),
    records: sbRepo<ServiceRecord>(sb, "records", true),
    imports: sbRepo<ImportLog>(sb, "imports", false),
  };
}

export const newId = () => randomUUID();
export const nextCustomerId = (list: { id: string }[]) =>
  String(list.reduce((m, c) => Math.max(m, parseInt(c.id, 10) || 0), 0) + 1);
