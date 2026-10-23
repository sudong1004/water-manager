import { NextResponse } from "next/server";
import { getRepos, newId } from "../../../../../lib/repo";
import type { ServiceRecord } from "../../../../../lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 필터 교환 완료: 교환일 갱신 + 필터교체 이력 기록을 서버에서 한 번에 처리 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { names: string[]; date: string } | null;
  if (!body) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { names, date } = body;
  if (!Array.isArray(names) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const { customers, records } = await getRepos();
    const c = await customers.get(id);
    if (!c) return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
    const targets = c.filters.filter((f) => names.includes(f.name) && f.lastChange < date);
    if (!targets.length) return NextResponse.json({ error: "이미 같은 날짜 이후에 교환 기록이 있습니다." }, { status: 409 });
    const next = { ...c, rev: (c.rev ?? 0) + 1, filters: c.filters.map((f) => (targets.includes(f) ? { ...f, lastChange: date, nextDate: undefined } : f)) };
    const record: ServiceRecord = {
      id: newId(), customerId: id, date, type: "필터교체", content: `${targets.map((f) => f.name).join(", ")} 교체`, nextVisit: "",
      filters: targets.map((f) => ({ name: f.name, prev: f.lastChange })),
    };
    // 이력을 먼저 저장 → 실패해도 교환일은 바뀌지 않아 다시 시도할 수 있음
    await records.insert(record);
    try {
      if (!(await customers.update(id, next))) throw new Error("고객 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
    } catch (e) { await records.remove(record.id); throw e; }
    return NextResponse.json({ customer: next, record });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
