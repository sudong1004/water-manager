import { NextResponse } from "next/server";
import { getRepos, newId } from "../../../../lib/repo";
import type { Customer, ImportLog } from "../../../../lib/types";

export const dynamic = "force-dynamic";

/** 미리보기에서 확인한 항목을 실제로 반영. 수납·이력 테이블은 건드리지 않는다. */
export async function POST(req: Request) {
  const { fileName, items, errors } = (await req.json()) as {
    fileName: string; errors: number;
    items: { status: "new" | "update" | "same"; customer: Customer }[];
  };
  try {
    const { customers, imports } = await getRepos();
    const todo = items.filter((i) => i.status !== "same");
    await customers.upsertMany(todo.map((i) => i.customer));
    const log: ImportLog = {
      id: newId(), at: new Date().toISOString(), fileName, errors,
      added: items.filter((i) => i.status === "new").length,
      updated: items.filter((i) => i.status === "update").length,
      unchanged: items.filter((i) => i.status === "same").length,
    };
    await imports.insert(log);
    return NextResponse.json(log);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
