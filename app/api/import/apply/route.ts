import { NextResponse } from "next/server";
import { getRepos, newId } from "../../../../lib/repo";
import type { Customer, ImportLog } from "../../../../lib/types";
import { normalizeCustomer } from "../../../../lib/utils";

export const dynamic = "force-dynamic";

/** 미리보기에서 확인한 항목을 실제로 반영. 수납·이력 테이블은 건드리지 않는다. */
export async function POST(req: Request) {
  let body: { fileName: string; errors: number; unchanged?: number; items: { status: "new" | "update" | "same"; customer: Customer }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const { fileName, items, errors } = body;
  if (!Array.isArray(items)) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    const { customers, imports } = await getRepos();
    const todo = items.filter((i) => i.status !== "same");
    if (todo.some((i) => !i.customer?.id?.trim() || !i.customer?.name?.trim()))
      return NextResponse.json({ error: "관리번호나 고객명이 없는 항목이 있습니다." }, { status: 400 });
    await customers.upsertMany(todo.map((i) => normalizeCustomer(i.customer)));
    const log: ImportLog = {
      id: newId(), at: new Date().toISOString(), fileName, errors,
      added: items.filter((i) => i.status === "new").length,
      updated: items.filter((i) => i.status === "update").length,
      unchanged: Number(body.unchanged) || items.filter((i) => i.status === "same").length,
    };
    await imports.insert(log);
    return NextResponse.json(log);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
