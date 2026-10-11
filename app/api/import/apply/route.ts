import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mutate } from "../../../../lib/store";
import type { Customer, ImportLog } from "../../../../lib/types";

export const dynamic = "force-dynamic";

/** 미리보기에서 확인한 항목을 실제로 반영. 수납·이력은 건드리지 않음(별도 파일) */
export async function POST(req: Request) {
  const { fileName, items, errors } = (await req.json()) as {
    fileName: string; errors: number;
    items: { status: "new" | "update" | "same"; customer: Customer }[];
  };
  const result = await mutate<Customer, { added: number; updated: number; unchanged: number }>("customers", (list) => {
    const byId = new Map(list.map((c) => [c.id, c]));
    let added = 0, updated = 0, unchanged = 0;
    const fresh: Customer[] = [];
    for (const it of items) {
      if (it.status === "same") { unchanged++; continue; }
      if (byId.has(it.customer.id)) { byId.set(it.customer.id, it.customer); updated++; }
      else { fresh.push(it.customer); added++; }
    }
    const next = [...fresh, ...list.map((c) => byId.get(c.id) ?? c)];
    return { list: next, result: { added, updated, unchanged } };
  });
  const log: ImportLog = { id: randomUUID(), at: new Date().toISOString(), fileName, errors, ...result };
  await mutate<ImportLog, null>("imports", (l) => ({ list: [log, ...l].slice(0, 100), result: null }));
  return NextResponse.json(log);
}
