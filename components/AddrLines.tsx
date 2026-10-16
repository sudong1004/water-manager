"use client";
import type { Customer } from "../lib/types";
import { fullAddr, roadFull } from "../lib/utils";
import { useAddrMode } from "../lib/addr-mode";

/** 보기 방식에 맞춰 지번/도로명 주소를 보여준다. copy=true면 복사 버튼 포함 */
export default function AddrLines({ c, copy, onCopied }: { c: Customer; copy?: boolean; onCopied?: (m: string) => void }) {
  const mode = useAddrMode();
  const jibun = fullAddr(c);
  const road = roadFull(c);
  const rows: [string, string][] = [];
  if (mode !== "road" || !road) rows.push(["지번", jibun]);
  if (mode !== "jibun" && road) rows.push(["도로명", road]);
  if (mode === "both" && !road && jibun) rows.push(["도로명", "지도 탭을 열면 자동으로 찾아옵니다"]);
  const doCopy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); onCopied?.("주소를 복사했습니다."); } catch { onCopied?.("복사하지 못했습니다."); }
  };
  if (!jibun) return <span>주소 없음</span>;
  return (
    <span className="block space-y-0.5">
      {rows.map(([label, t]) => (
        <span key={label} className="flex items-start gap-1.5">
          {mode === "both" && <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{label}</span>}
          <span className={`min-w-0 break-words ${t.startsWith("지도 탭") ? "text-xs text-slate-400" : ""}`}>{t}</span>
          {copy && !t.startsWith("지도 탭") && <button type="button" onClick={() => doCopy(t)} className="ml-auto shrink-0 rounded px-1.5 text-xs font-medium text-sky-700 active:bg-sky-50">복사</button>}
        </span>
      ))}
    </span>
  );
}
