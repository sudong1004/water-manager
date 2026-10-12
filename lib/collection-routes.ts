import { NextResponse } from "next/server";
import { getRepos, newId, type Repos } from "./repo";

type Row = { id: string; customerId: string };
type Key = "payments" | "records";
const errRes = (e: unknown) => NextResponse.json({ error: (e as Error).message }, { status: 500 });

export function collectionRoutes<T extends Row>(key: Key, validate: (b: Partial<T>) => string | null) {
  const repo = async () => (await getRepos())[key] as unknown as Repos["payments"];
  return {
    async GET() {
      try { return NextResponse.json(await (await repo()).list()); } catch (e) { return errRes(e); }
    },
    async POST(req: Request) {
      const body = (await req.json()) as Partial<T>;
      const err = validate(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      try {
        const row = { ...body, id: newId() } as T;
        await (await repo()).insert(row as never);
        return NextResponse.json(row, { status: 201 });
      } catch (e) { return errRes(e); }
    },
  };
}

export function itemRoutes<T extends Row>(key: Key, validate: (b: Partial<T>) => string | null) {
  type Ctx = { params: Promise<{ id: string }> };
  const repo = async () => (await getRepos())[key] as unknown as Repos["payments"];
  return {
    async PUT(req: Request, { params }: Ctx) {
      const { id } = await params;
      const body = (await req.json()) as Partial<T>;
      const err = validate(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      try {
        const r = await repo();
        const old = await r.get(id);
        if (!old) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
        const row = { ...old, ...body, id, customerId: old.customerId };
        await r.update(id, row as never);
        return NextResponse.json(row);
      } catch (e) { return errRes(e); }
    },
    async DELETE(_: Request, { params }: Ctx) {
      const { id } = await params;
      try { await (await repo()).remove(id); return NextResponse.json({ ok: true }); } catch (e) { return errRes(e); }
    },
  };
}
