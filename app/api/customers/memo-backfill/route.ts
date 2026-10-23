import { NextResponse } from "next/server";
import { getRepos } from "../../../../lib/repo";
import { backfillMemos } from "../../../../lib/memo";

export const dynamic = "force-dynamic";

/** 예전 특이사항 이력을 고객 메모에 한 번에 옮김 (이미 옮긴 줄은 건너뜀) */
export async function POST() {
  try {
    const { customers, records } = await getRepos();
    const [cs, rs] = await Promise.all([customers.list(), records.list()]);
    const { changed, added } = backfillMemos(cs, rs);
    await customers.upsertMany(changed);
    return NextResponse.json({ added, customers: changed.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
