import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getRepos } from "../../../lib/repo";
import { todayStr } from "../../../lib/utils";

export const dynamic = "force-dynamic";

/** 전체 백업: ?format=json(복구용, 모든 필드) 또는 xlsx(읽기용) */
export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "json";
  try {
    const { customers, payments, records } = await getRepos();
    const [cs, ps, rs] = await Promise.all([customers.list(), payments.list(), records.list()]);
    const stamp = todayStr();
    const headers = { "Cache-Control": "no-store" };

    if (format === "json") {
      const body = JSON.stringify({ exportedAt: new Date().toISOString(), customers: cs, payments: ps, records: rs }, null, 1);
      return new NextResponse(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="water-crm-backup-${stamp}.json"` } });
    }

    const name = new Map(cs.map((c) => [c.id, c.name]));
    const wb = XLSX.utils.book_new();
    const add = (title: string, rows: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title);
    add("고객", cs.map(({ filters, lat, lng, geoAddr, roadAddr, rev, ...c }) => ({ ...c, 필터: filters.map((f) => `${f.name}(${f.cycleDays}일/${f.lastChange || "-"}${f.nextDate ? `/예정 ${f.nextDate}` : ""})`).join(" | ") })));
    add("수납", ps.map((p) => ({ 날짜: p.date, 관리번호: p.customerId, 고객명: name.get(p.customerId) ?? "", 구분: p.kind, 금액: p.amount, 수단: p.method, 메모: p.memo, PC입력: p.entered ? "완료" : "" })));
    add("이력", rs.map((r) => ({ 날짜: r.date, 관리번호: r.customerId, 고객명: name.get(r.customerId) ?? "", 구분: r.type, 내용: r.content, 방문예정일: r.nextVisit, PC입력: r.entered ? "완료" : "" })));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="water-crm-backup-${stamp}.xlsx"` } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
