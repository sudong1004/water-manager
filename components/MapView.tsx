"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Customer } from "../lib/types";
import { api } from "../lib/api";
import AddrLines from "./AddrLines";
import AddrToggle from "./AddrToggle";
import { dueLabel, dueTone, fullAddr, firstPhone, hasCoord, mapAddress, nextDue, regionOf, won } from "../lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { kakao?: any } }

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

let sdkPromise: Promise<any> | null = null;
function loadKakao(): Promise<any> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const done = () => window.kakao.maps.load(() => resolve(window.kakao));
    if (window.kakao?.maps) return done();
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = done;
    s.onerror = () => { sdkPromise = null; reject(new Error("sdk")); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

let geoBusy = false; // 탭을 오가도 변환 작업이 겹쳐 돌지 않게
const tried = new Set<string>(); // 이번 접속에서 이미 시도한 (고객+주소) — 못 찾은 주소를 무한 재시도하지 않게
const triedKey = (c: Customer) => `${c.id}|${mapAddress(c)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 주소 → 좌표. ① 번지까지 ② 아파트·건물명 키워드 ③ 동(주소1)까지만 — 순서대로 시도한다. */
type Geo = { lat: number; lng: number; road: string };
function geocode(kakao: any, c: Customer): Promise<Geo | null> {
  const geocoder = new kakao.maps.services.Geocoder();
  const places = new kakao.maps.services.Places();
  const addrSearch = (q: string) =>
    new Promise<Geo | null>((resolve) => {
      if (!q) return resolve(null);
      geocoder.addressSearch(q, (res: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK && res[0]) resolve({ lat: Number(res[0].y), lng: Number(res[0].x), road: res[0].road_address?.address_name ?? "" });
        else resolve(null);
      });
    });
  const keyword = (q: string) =>
    new Promise<Geo | null>((resolve) => {
      if (!q) return resolve(null);
      places.keywordSearch(q, (res: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK && res[0]) resolve({ lat: Number(res[0].y), lng: Number(res[0].x), road: res[0].road_address_name ?? "" });
        else resolve(null);
      });
    });
  // 주소2에서 번지·동호수를 뺀 건물명 (예: "1126번지 휴먼시아@ 206동309호" → "휴먼시아")
  const building = c.addr2
    .replace(/^(산\s*)?\d+(-\d+)?\s*번?지?/, "")
    .replace(/[@()\[\]]/g, " ")
    .replace(/\d+\s*동.*$/, "")
    .replace(/\d+\s*호.*$/, "")
    .trim();
  return addrSearch(mapAddress(c))
    .then((r) => r ?? (building ? keyword(`${c.addr1.trim()} ${building}`) : null))
    .then((r) => r ?? addrSearch(c.addr1.trim()));
}

type Seg = "all" | "overdue" | "soon" | "debt";

function pinColor(c: Customer, debt: boolean) {
  const d = nextDue(c);
  const bg = !d ? "bg-slate-400" : d.left < 0 ? "bg-red-600" : d.left <= 14 ? "bg-amber-500" : "bg-emerald-600";
  return { bg, debt };
}

export default function MapView({
  customers, balances, open, reload, notify,
}: {
  customers: Customer[]; balances: Map<string, number>; open: (id: string) => void;
  reload: () => Promise<void>; notify: (m: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const meRef = useRef<any>(null);
  const [kakao, setKakao] = useState<any>(null);
  const [err, setErr] = useState("");
  const [seg, setSeg] = useState<Seg>("all");
  const [sigungu, setSigungu] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  
  // SDK 로드 + 지도 생성
  useEffect(() => {
    if (!KEY) return;
    let alive = true;
    loadKakao()
      .then((k) => {
        if (!alive || !box.current) return;
        mapRef.current = new k.maps.Map(box.current, { center: new k.maps.LatLng(37.36, 126.93), level: 8 });
        setKakao(k);
      })
      .catch(() => alive && setErr("카카오 지도를 불러오지 못했습니다. 카카오 개발자 콘솔의 [플랫폼 → Web]에 현재 사이트 주소(예: http://localhost:3000)가 등록되어 있는지, JavaScript 키가 맞는지 확인하세요."));
    return () => { alive = false; };
  }, []);

  // 좌표가 없는(또는 주소가 바뀐) 고객을 순서대로 변환해서 저장
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todo = useMemo(() => customers.filter((c) => c.addr1.trim() && (!hasCoord(c) || typeof c.roadAddr !== "string") && !tried.has(triedKey(c))), [customers, retry]);
  useEffect(() => {
    if (!kakao || geoBusy || todo.length === 0) return;
    geoBusy = true;
    (async () => {
      const fails: string[] = [];
      let n = 0;
      setProg({ done: 0, total: todo.length });
      let saved = 0;
      for (const c of todo) {
        tried.add(triedKey(c));
        const r = await geocode(kakao, c);
        if (r) {
          try { await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify({ ...c, lat: r.lat, lng: r.lng, roadAddr: r.road, geoAddr: mapAddress(c) }) }); saved++; }
          catch { fails.push(c.name); }
        } else if (hasCoord(c)) {
          // 위치는 이미 있고 도로명만 못 찾은 경우: 빈 값으로 저장해 다시 시도하지 않게 함
          try { await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify({ ...c, roadAddr: "" }) }); saved++; } catch { /* ignore */ }
        } else fails.push(c.name);
        setProg({ done: ++n, total: todo.length });
        await sleep(60);
      }
      setFailed(fails);
      setProg(null);
      if (saved > 0) await reload();
      geoBusy = false;
      notify(fails.length ? `위치 변환 완료 (${fails.length}명은 주소를 찾지 못함)` : "모든 고객의 위치를 찾았습니다.");
    })();
  }, [kakao, todo, reload, notify]);

  // 필터
  const sigunguList = useMemo(() => Array.from(new Set(customers.map((c) => regionOf(c).sigungu))).sort((a, b) => a.localeCompare(b, "ko")), [customers]);
  const shown = useMemo(() => customers.filter((c) => {
    if (!hasCoord(c)) return false;
    if (sigungu && regionOf(c).sigungu !== sigungu) return false;
    const d = nextDue(c);
    if (seg === "overdue" && !(d && d.left < 0)) return false;
    if (seg === "soon" && !(d && d.left >= 0 && d.left <= 14)) return false;
    if (seg === "debt" && !(balances.get(c.id) ?? 0)) return false;
    return true;
  }), [customers, seg, sigungu, balances]);

  // 같은 좌표(같은 아파트·건물)에 있는 고객은 한 핀으로 묶는다 — 겹쳐서 안 보이는 일을 막기 위해
  const groups = useMemo(() => {
    const m = new Map<string, Customer[]>();
    shown.forEach((c) => { const k = `${c.lat!.toFixed(5)},${c.lng!.toFixed(5)}`; m.set(k, [...(m.get(k) ?? []), c]); });
    return Array.from(m.entries()).map(([key, list]) => ({ key, list }));
  }, [shown]);

  // 마커 그리기 (필터가 바뀔 때만 지도 영역을 다시 맞춤)
  const lastKey = useRef("");
  useEffect(() => {
    if (!kakao || !mapRef.current) return;
    const key = shown.map((c) => c.id + c.lat + c.lng).join(",") + seg + sigungu;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    const bounds = new kakao.maps.LatLngBounds();
    const rank = (bg: string) => (bg.includes("red") ? 0 : bg.includes("amber") ? 1 : bg.includes("emerald") ? 2 : 3);
    groups.forEach(({ key: gk, list }) => {
      const first = list[0];
      const pos = new kakao.maps.LatLng(first.lat!, first.lng!);
      const debt = list.some((c) => (balances.get(c.id) ?? 0) > 0);
      const bg = list.map((c) => pinColor(c, false).bg).sort((x, y) => rank(x) - rank(y))[0];
      const label = (list.length > 1 ? `${first.name} 외 ${list.length - 1}` : first.name).replace(/[<>&]/g, "");
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("data-pin", gk);
      el.className = "relative -translate-x-1/2 cursor-pointer";
      el.innerHTML =
        `<span class="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white ${bg} px-1 text-[11px] font-bold text-white shadow-lg ring-1 ring-black/20">${list.length > 1 ? list.length : ""}</span>` +
        (debt ? `<span class="absolute -right-2 -top-2 rounded-full bg-white px-1 text-[10px] font-bold text-red-600 shadow ring-1 ring-red-300">₩</span>` : "") +
        `<span class="absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-semibold text-slate-700 shadow">${label}</span>`;
      el.addEventListener("click", () => setSel(gk));
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5 });
      ov.setMap(mapRef.current);
      overlays.current.push(ov);
      bounds.extend(pos);
    });
    if (shown.length && key !== lastKey.current) { mapRef.current.setBounds(bounds); lastKey.current = key; }
  }, [kakao, shown, groups, seg, sigungu, balances]);

  // 지도 영역이 탭 전환 등으로 크기가 바뀔 때 보정
  useEffect(() => { if (kakao && mapRef.current) setTimeout(() => mapRef.current.relayout(), 100); }, [kakao]);

  function locate() {
    if (!navigator.geolocation) return notify("이 브라우저는 위치 기능을 지원하지 않습니다.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = new kakao.maps.LatLng(p.coords.latitude, p.coords.longitude);
        meRef.current?.setMap(null);
        const dot = document.createElement("div");
        dot.className = "h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-lg ring-4 ring-blue-300/50";
        meRef.current = new kakao.maps.CustomOverlay({ position: pos, content: dot, zIndex: 20 });
        meRef.current.setMap(mapRef.current);
        mapRef.current.setCenter(pos);
        mapRef.current.setLevel(5);
      },
      () => notify("현재 위치를 가져오지 못했습니다. 브라우저의 위치 권한을 확인하세요."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const chip = (k: Seg, label: string) => (
    <button key={k} onClick={() => setSeg(k)} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${seg === k ? "bg-sky-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300"}`}>{label}</button>
  );
  const pickedGroup = sel ? groups.find((g) => g.key === sel) : undefined;
  const missing = customers.filter((c) => c.addr1.trim() && !hasCoord(c));

  const CustomerRow = ({ c, solo }: { c: Customer; solo: boolean }) => {
    const due = nextDue(c);
    const bal = balances.get(c.id) ?? 0;
    const phone = firstPhone(c);
    return (
      <div className={solo ? "" : "rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-bold">{c.name}</div>
            <div className="mt-0.5 text-sm text-slate-600"><AddrLines c={c} copy onCopied={notify} /></div>
          </div>
          {solo && <button onClick={() => setSel(null)} className="rounded px-2 py-1 text-slate-400" aria-label="닫기">✕</button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {due && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${dueTone(due.left)}`}>{due.filter.name} {dueLabel(due.left)}</span>}
          {bal > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">미수 {won(bal)}</span>}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="rounded-lg bg-sky-700 py-2.5 text-center text-sm font-semibold text-white active:bg-sky-800">📞 전화</a> : <span className="rounded-lg bg-slate-100 py-2.5 text-center text-sm text-slate-400">전화 없음</span>}
          <a href={`https://map.kakao.com/link/to/${encodeURIComponent(c.name)},${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white active:bg-emerald-700">🚗 길찾기</a>
          <button onClick={() => open(c.id)} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50">상세</button>
        </div>
      </div>
    );
  };

  if (!KEY) {
    return (
      <div className="px-4 pt-4">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold text-sky-800">🗺 지도 설정이 필요합니다</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li><a className="text-sky-700 underline" href="https://developers.kakao.com" target="_blank" rel="noreferrer">developers.kakao.com</a>에서 애플리케이션을 추가합니다.</li>
            <li>[앱 설정 → 플랫폼 → Web]에 사이트 주소를 등록합니다. (예: <code className="rounded bg-slate-100 px-1">http://localhost:3000</code>, 배포 주소)</li>
            <li>[앱 키]의 <b>JavaScript 키</b>를 복사해 <code className="rounded bg-slate-100 px-1">.env.local</code>에 한 줄 추가합니다.<pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">NEXT_PUBLIC_KAKAO_MAP_KEY=복사한_키</pre></li>
            <li>서버를 껐다 켠 뒤(<code className="rounded bg-slate-100 px-1">.next</code> 폴더 삭제 권장) 이 화면을 새로고침합니다.</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {chip("all", "전체")}{chip("overdue", "🔴 교환 지연")}{chip("soon", "🟠 14일 내")}{chip("debt", "₩ 미수금")}
        <AddrToggle />
        <select value={sigungu} onChange={(e) => setSigungu(e.target.value)} className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="">지역 전체</option>{sigunguList.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      {prog && (
        <div className="mb-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
          📍 주소를 위치로 변환 중… {prog.done}/{prog.total}
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-sky-100"><div className="h-full bg-sky-600 transition-all" style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>
        </div>
      )}
      {err && <p className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="relative overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200">
        <div ref={box} className="h-[58dvh] w-full bg-slate-200 sm:h-[68dvh]" />
        {kakao && (
          <button onClick={locate} className="absolute right-3 top-3 z-10 rounded-full bg-white px-3.5 py-2.5 text-sm font-semibold text-sky-700 shadow-lg ring-1 ring-slate-200 active:bg-slate-50">📍 내 위치</button>
        )}
        <div className="absolute left-3 top-3 z-10 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs text-slate-600 shadow ring-1 ring-slate-200">
          {shown.length}명 표시 · <span className="text-red-600">●</span>지연 <span className="text-amber-500">●</span>임박 <span className="text-emerald-600">●</span>정상
        </div>

        {pickedGroup && (
          <div className="absolute inset-x-3 bottom-3 z-10 max-h-[70%] overflow-y-auto rounded-xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
            {pickedGroup.list.length === 1 ? (
              <CustomerRow c={pickedGroup.list[0]} solo />
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-bold text-sky-800">📍 같은 위치 {pickedGroup.list.length}명</div>
                  <button onClick={() => setSel(null)} className="rounded px-2 py-1 text-slate-400" aria-label="닫기">✕</button>
                </div>
                <div className="space-y-2">{pickedGroup.list.map((c) => <CustomerRow key={c.id} c={c} solo={false} />)}</div>
              </>
            )}
          </div>
        )}
      </div>

      {missing.length > 0 && !prog && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center justify-between gap-2">
            <b>지도에서 위치를 찾지 못한 고객 {missing.length}명</b>
            <button onClick={() => { tried.clear(); setFailed([]); setRetry((n) => n + 1); }} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 active:bg-amber-100">다시 찾기</button>
          </div>
          <ul className="mt-2 divide-y divide-amber-100">
            {missing.map((c) => (
              <li key={c.id}>
                <button onClick={() => open(c.id)} className="flex w-full items-baseline gap-2 py-1.5 text-left">
                  <span className="shrink-0 font-semibold">{c.name}</span>
                  <span className="min-w-0 truncate text-xs text-amber-700">{fullAddr(c)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-700">주소(주소1·번지)를 고쳐 저장하면 자동으로 다시 찾습니다.</p>
        </div>
      )}
      {customers.length > 0 && customers.filter((c) => !c.addr1.trim()).length > 0 && (
        <p className="mt-2 text-xs text-slate-400">주소가 없는 고객 {customers.filter((c) => !c.addr1.trim()).length}명은 지도에 표시되지 않습니다.</p>
      )}
    </div>
  );
}
