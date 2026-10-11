import { NextResponse } from "next/server";
import { mutate } from "../../../../lib/store";
import type { Customer, Payment, ServiceRecord } from "../../../../lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as Customer;
  if (!body.name?.trim()) return NextResponse.json({ error: "고객명은 필수입니다." }, { status: 400 });
  try {
    const newId = body.id?.trim() || id;
    const updated = await mutate<Customer, Customer>("customers", (list) => {
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) throw new Error("고객을 찾을 수 없습니다.");
      if (newId !== id && list.some((c) => c.id === newId)) throw new Error("이미 사용 중인 관리번호입니다.");
      const c = { ...body, id: newId };
      const next = [...list];
      next[i] = c;
      return { list: next, result: c };
    });
    // 관리번호를 바꾸면 수납/이력도 새 번호로 이동
    if (newId !== id) {
      const move = <T extends { customerId: string }>(l: T[]) => l.map((r) => (r.customerId === id ? { ...r, customerId: newId } : r));
      await mutate<Payment, null>("payments", (l) => ({ list: move(l), result: null }));
      await mutate<ServiceRecord, null>("records", (l) => ({ list: move(l), result: null }));
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await mutate<Customer, null>("customers", (list) => ({ list: list.filter((c) => c.id !== id), result: null }));
  await mutate<Payment, null>("payments", (l) => ({ list: l.filter((r) => r.customerId !== id), result: null }));
  await mutate<ServiceRecord, null>("records", (l) => ({ list: l.filter((r) => r.customerId !== id), result: null }));
  return NextResponse.json({ ok: true });
}
