import { NextResponse } from "next/server";
import { mutate, nextId, readAll } from "../../../lib/store";
import type { Customer } from "../../../lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readAll<Customer>("customers"));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Customer;
  if (!body.name?.trim()) return NextResponse.json({ error: "고객명은 필수입니다." }, { status: 400 });
  try {
    const created = await mutate<Customer, Customer>("customers", (list) => {
      const id = body.id?.trim() || nextId(list);
      if (list.some((c) => c.id === id)) throw new Error("이미 사용 중인 관리번호입니다.");
      const c = { ...body, id };
      return { list: [c, ...list], result: c };
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
