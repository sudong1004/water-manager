import { NextResponse } from "next/server";
import { getRepos, newId } from "../../../lib/repo";
import { parseBackup, planRestore } from "../../../lib/restore";
import type { ImportLog } from "../../../lib/types";

export const dynamic = "force-dynamic";

/** 백업 복원(병합). apply=false면 미리보기만, true면 저장. 현재에만 있는 데이터는 지우지 않는다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { data?: unknown; apply?: boolean; fileName?: string } | null;
  if (!body) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const parsed = parseBackup(body.data);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const { customers, payments, records, imports } = await getRepos();
    const [cc, pp, rr] = await Promise.all([customers.list(), payments.list(), records.list()]);
    const plan = planRestore({ customers: cc, payments: pp, records: rr }, parsed.data);
    const { write, ...summary } = plan;
    if (body.apply) {
      await customers.upsertMany(write.customers);
      await payments.upsertMany(write.payments);
      await records.upsertMany(write.records);
      const log: ImportLog = { id: newId(), at: new Date().toISOString(), fileName: `백업 복원: ${String(body.fileName ?? "").slice(0, 80)}`,
        added: plan.customers.new + plan.payments.new + plan.records.new, updated: plan.customers.changed + plan.payments.changed + plan.records.changed, unchanged: plan.customers.same + plan.payments.same + plan.records.same, errors: 0 };
      await imports.insert(log);
    }
    return NextResponse.json({ ...summary, applied: Boolean(body.apply) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
