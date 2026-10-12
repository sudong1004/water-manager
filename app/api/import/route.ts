import { NextResponse } from "next/server";
import { getRepos } from "../../../lib/repo";
import { mergeCustomer, parseWorkbook } from "../../../lib/excel";
import type { Customer } from "../../../lib/types";

export const dynamic = "force-dynamic";

/** 미리보기: 파일을 읽어 신규/수정/동일/오류를 구분해서 돌려줌 (저장은 하지 않음) */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "파일을 선택해 주세요." }, { status: 400 });
  let parsed;
  try {
    parsed = parseWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽을 수 없습니다. .xls / .xlsx 파일인지 확인해 주세요." }, { status: 400 });
  }
  if (parsed.missingHeaders.length)
    return NextResponse.json({ error: `필수 열을 찾을 수 없습니다: ${parsed.missingHeaders.join(", ")}` }, { status: 400 });

  const existing = new Map((await (await getRepos()).customers.list()).map((c) => [c.id, c]));
  const items = parsed.customers.map((inc) => {
    const old = existing.get(inc.id);
    if (!old) return { status: "new" as const, id: inc.id, name: inc.name, changes: [] as string[], customer: inc };
    const { merged, changed } = mergeCustomer(old, inc);
    return { status: changed.length ? ("update" as const) : ("same" as const), id: inc.id, name: inc.name, changes: changed, customer: merged };
  });
  return NextResponse.json({
    fileName: file.name, items, errors: parsed.errors,
    summary: {
      new: items.filter((i) => i.status === "new").length,
      update: items.filter((i) => i.status === "update").length,
      same: items.filter((i) => i.status === "same").length,
      errors: parsed.errors.length,
    },
  });
}
