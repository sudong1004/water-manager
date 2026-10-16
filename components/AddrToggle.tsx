"use client";
import { setAddrMode, useAddrMode } from "../lib/addr-mode";
import type { AddrMode } from "../lib/utils";

const OPTS: [AddrMode, string][] = [["jibun", "지번"], ["road", "도로명"], ["both", "둘 다"]];

export default function AddrToggle() {
  const mode = useAddrMode();
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-slate-300" role="group" aria-label="주소 표시 방식">
      {OPTS.map(([k, l]) => (
        <button key={k} type="button" onClick={() => setAddrMode(k)}
          className={`px-3 py-2 text-sm font-semibold ${mode === k ? "bg-sky-700 text-white" : "bg-white text-slate-600"}`}>{l}</button>
      ))}
    </div>
  );
}
