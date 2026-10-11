import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mutate, readAll } from "./store";

type Row = { id: string; customerId: string };

export function collectionRoutes<T extends Row>(name: string, validate: (b: Partial<T>) => string | null) {
  return {
    async GET() {
      return NextResponse.json(await readAll<T>(name));
    },
    async POST(req: Request) {
      const body = (await req.json()) as Partial<T>;
      const err = validate(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      const row = { ...body, id: randomUUID() } as T;
      await mutate<T, null>(name, (list) => ({ list: [row, ...list], result: null }));
      return NextResponse.json(row, { status: 201 });
    },
  };
}

export function itemRoutes<T extends Row>(name: string, validate: (b: Partial<T>) => string | null) {
  type Ctx = { params: Promise<{ id: string }> };
  return {
    async PUT(req: Request, { params }: Ctx) {
      const { id } = await params;
      const body = (await req.json()) as Partial<T>;
      const err = validate(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      const row = await mutate<T, T | null>(name, (list) => {
        const i = list.findIndex((r) => r.id === id);
        if (i < 0) return { list, result: null };
        const next = [...list];
        next[i] = { ...next[i], ...body, id, customerId: next[i].customerId };
        return { list: next, result: next[i] };
      });
      return row ? NextResponse.json(row) : NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    },
    async DELETE(_: Request, { params }: Ctx) {
      const { id } = await params;
      await mutate<T, null>(name, (list) => ({ list: list.filter((r) => r.id !== id), result: null }));
      return NextResponse.json({ ok: true });
    },
  };
}
