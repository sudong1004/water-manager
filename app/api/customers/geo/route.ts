import { NextResponse } from "next/server";
import { getRepos } from "../../../../lib/repo";

export const dynamic = "force-dynamic";

type Geo = { id: string; lat?: number; lng?: number; roadAddr?: string; geoAddr?: string };

/** 지도 좌표 캐시만 부분 갱신 (다른 필드는 서버의 최신 값을 그대로 유지) */
export async function POST(req: Request) {
  let body: { items?: Geo[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const items = body.items;
  if (!Array.isArray(items) || items.length > 500) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    const { customers } = await getRepos();
    const byId = new Map(items.map((i) => [String(i.id), i]));
    const rows = (await customers.list()).filter((c) => byId.has(c.id)).map((c) => {
      const g = byId.get(c.id)!;
      return {
        ...c,
        ...(typeof g.lat === "number" && typeof g.lng === "number" ? { lat: g.lat, lng: g.lng } : {}),
        ...(typeof g.roadAddr === "string" ? { roadAddr: g.roadAddr } : {}),
        ...(typeof g.geoAddr === "string" ? { geoAddr: g.geoAddr } : {}),
      };
    });
    await customers.upsertMany(rows);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
