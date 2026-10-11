import { NextResponse } from "next/server";
import { readAll } from "../../../lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await readAll("imports"));
}
