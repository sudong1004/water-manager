import { NextResponse } from "next/server";
import { getRepos } from "../../../../../lib/repo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 휴지통에서 고객 복구 */
export async function POST(_: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { customers } = await getRepos();
    const c = await customers.get(id);
    if (!c) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    const { deletedAt, ...rest } = c;
    void deletedAt;
    const back = { ...rest, rev: (c.rev ?? 0) + 1 };
    if (!(await customers.update(id, back))) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(back);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
