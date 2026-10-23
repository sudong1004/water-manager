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
    const c = normalizeCustomer({ ...body, id: body.id?.trim() || id });
    if (!(await customers.update(id, c))) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    // 관리번호를 바꾸면 수납/이력도 새 번호로 이동
    if (c.id !== id) { await payments.reassignCustomer(id, c.id); await records.reassignCustomer(id, c.id); }
    return NextResponse.json(c);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof DuplicateError ? 409 : 500 });
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { customers, payments, records } = await getRepos();
    await payments.removeByCustomer(id);
    await records.removeByCustomer(id);
    await customers.remove(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
