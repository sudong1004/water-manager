import { NextResponse } from "next/server";
import { getRepos } from "../../../lib/repo";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await (await getRepos()).imports.list());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
