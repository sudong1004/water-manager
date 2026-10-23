import { NextResponse } from "next/server";
import { DuplicateError, getRepos, nextCustomerId } from "../../../lib/repo";
import type { Customer } from "../../../lib/types";
import { normalizeCustomer } from "../../../lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await (await getRepos()).customers.list());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Customer | null;
  if (!body) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "고객명은 필수입니다." }, { status: 400 });
  try {
    const { customers } = await getRepos();
    const c = normalizeCustomer({ ...body, id: body.id?.trim() || nextCustomerId(await customers.list()) });
    await customers.insert(c);
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof DuplicateError ? 409 : 500 });
  }
}
