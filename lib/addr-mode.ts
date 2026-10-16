"use client";
import { useSyncExternalStore } from "react";
import type { AddrMode } from "./utils";

const KEY = "addrMode";
const listeners = new Set<() => void>();
let cache: AddrMode | null = null;
const read = (): AddrMode => {
  if (cache) return cache;
  try { const v = localStorage.getItem(KEY); if (v === "jibun" || v === "road" || v === "both") return (cache = v); } catch { /* 저장소를 못 쓰는 환경 */ }
  return (cache = "both");
};
export function setAddrMode(m: AddrMode) {
  cache = m;
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
/** 주소 보기 방식(지번 / 도로명 / 둘 다) — 모든 화면에서 공유 */
export function useAddrMode(): AddrMode {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => "both" as AddrMode,
  );
}
