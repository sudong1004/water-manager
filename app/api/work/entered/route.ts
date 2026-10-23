import { NextResponse } from "next/server";
import { getRepos } from "../../../../lib/repo";

export const dynamic = "force-dynamic";

/** 여러 이력/수납을 한 번에 "PC 입력 완료" 표시 (또는 해제) */
export async function POST(req: Request) {
  let body: { records?: string[]; payments?: string[]; value?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const { records: rids = [], payments: pids = [], value } = body;
  if (typeof value !== "boolean" || !Array.isArray(rids) || !Array.isArray(pids))
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    const { records, payments } = await getRepos();
    const rset = new Set(rids), pset = new Set(pids);
    const [rl, pl] = await Promise.all([rset.size ? records.list() : [], pset.size ? payments.list() : []]);
    await Promise.all([
      records.upsertMany(rl.filter((r) => rset.has(r.id)).map((r) => ({ ...r, entered: value }))),
      payments.upsertMany(pl.filter((p) => pset.has(p.id)).map((p) => ({ ...p, entered: value }))),
    ]);
    return NextResponse.json({ ok: true, count: rset.size + pset.size });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
