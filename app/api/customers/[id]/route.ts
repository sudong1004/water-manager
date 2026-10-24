import { NextResponse } from "next/server";
import { DuplicateError, getRepos } from "../../../../lib/repo";
import type { Customer } from "../../../../lib/types";
import { normalizeCustomer } from "../../../../lib/utils";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Customer | null;
  if (!body) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "고객명은 필수입니다." }, { status: 400 });
  try {
    const { customers, payments, records } = await getRepos();
    const cur = await customers.get(id);
    if (!cur) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    // 다른 기기에서 먼저 저장했다면(번호가 다르면) 덮어쓰지 않고 알린다
    if ((cur.rev ?? 0) !== (body.rev ?? 0))
      return NextResponse.json({ error: "다른 기기(또는 화면)에서 이 고객이 먼저 수정되었습니다. 🔄 새로고침한 뒤 다시 시도해 주세요." }, { status: 409 });
    const c = normalizeCustomer({ ...body, id: body.id?.trim() || id, rev: (cur.rev ?? 0) + 1 });
    if (!(await customers.update(id, c))) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    // 관리번호를 바꾸면 수납/이력도 새 번호로 이동
    if (c.id !== id) { await payments.reassignCustomer(id, c.id); await records.reassignCustomer(id, c.id); }
    return NextResponse.json(c);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof DuplicateError ? 409 : 500 });
  }
}

/** 기본: 휴지통으로 이동(수납·이력은 보관). ?permanent=1: 휴지통에 있는 고객을 영구 삭제 */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  try {
    const { customers, payments, records } = await getRepos();
    const cur = await customers.get(id);
    if (!cur) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    if (!permanent) {
      await customers.update(id, { ...cur, deletedAt: new Date().toISOString(), rev: (cur.rev ?? 0) + 1 });
      return NextResponse.json({ ok: true, trashed: true });
    }
    if (!cur.deletedAt) return NextResponse.json({ error: "먼저 휴지통으로 이동해야 영구 삭제할 수 있습니다." }, { status: 400 });
    await payments.removeByCustomer(id);
    await records.removeByCustomer(id);
    await customers.remove(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
