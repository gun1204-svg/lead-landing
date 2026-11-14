"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

type Reservation = {
  id: string;
  name: string | null;
  phone: string | null;
  landing_key: string | null;
  assigned_to: string | null;
  status: string | null;
  reservation_date: string | null;
  reservation_time: string | null;
  reservation_memo: string | null;
  reservation_status: string | null;
};

type ReservationDraft = {
  reservation_date: string;
  reservation_time: string;
  reservation_status: string;
  reservation_memo: string;
};

const LABELS: Record<string, string> = {
  "02": "눈밑", "03": "첫코", "04": "자가늑코끝성형",
  "05": "윤석호 코재수술", "06": "눈썹거상", "07": "기능코",
  "08": "비개방 코성형", "09": "일본 코수술", "10": "브이타이팅",
};
const RESERVATION_LABELS: Record<string, string> = {
  SCHEDULED: "예약 예정", COMPLETED: "방문 완료",
  CANCELLED: "예약 취소", NO_SHOW: "미방문",
};
function kstMonth() {
  return localToday().slice(0, 7);
}
function localToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function shiftMonth(value: string, change: number) {
  const [year, month] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + change, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const field: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 9, padding: "9px 10px", background: "white", color: "#111827", maxWidth: "100%" };
const button: React.CSSProperties = { ...field, cursor: "pointer", fontWeight: 700 };

export default function ReservationsClient() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const { data: session, status: authStatus } = useSession();
  const pageLK = path.match(/^\/(\d{1,2})\//)?.[1]?.padStart(2, "0") ?? "00";
  const userLK = String((session?.user as { landing_key?: string } | undefined)?.landing_key ?? "").padStart(2, "0");
  const isRoot = userLK === "00";
  const [month, setMonth] = useState(kstMonth);
  const [date, setDate] = useState(localToday);
  const [landingFilter, setLandingFilter] = useState(sp.get("landing_key") || "ALL");
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Record<string, ReservationDraft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace(`/${pageLK}/admin/login`);
  }, [authStatus, pageLK, router]);

  useEffect(() => {
    if (date.slice(0, 7) !== month) setDate(`${month}-01`);
  }, [month, date]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ month });
    if (landingFilter !== "ALL") params.set("landing_key", landingFilter);
    setLoading(true);
    setError("");
    fetch(`/api/admin/reservations?${params}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || "예약 목록 조회 실패");
        setItems(json.items ?? []);
        setAllowed(json.allowed_landing_keys ?? null);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message || "네트워크 오류"); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [authStatus, landingFilter, month, reload]);

  const filtered = useMemo(() => items.filter((r) =>
    !query.trim() || `${r.name ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [items, query]);
  const byDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of filtered) {
      const key = r.reservation_date ?? "";
      (map[key] ??= []).push(r);
    }
    return map;
  }, [filtered]);
  const [y, m] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const selected = byDate[date] ?? [];
  const enabledKeys = isRoot ? Object.keys(LABELS) : (allowed ?? [userLK]);

  const patch = useCallback((id: string, updates: Partial<ReservationDraft>) => {
    const r = items.find((item) => item.id === id);
    if (!r) return;
    setEditing((old) => ({
      ...old,
      [id]: {
        reservation_date: old[id]?.reservation_date ?? r.reservation_date ?? "",
        reservation_time: old[id]?.reservation_time ?? r.reservation_time?.slice(0, 5) ?? "",
        reservation_status: old[id]?.reservation_status ?? r.reservation_status ?? "SCHEDULED",
        reservation_memo: old[id]?.reservation_memo ?? r.reservation_memo ?? "",
        ...updates,
      },
    }));
  }, [items]);

  async function save(r: Reservation) {
    const d = editing[r.id];
    if (!d) return;
    if (!d.reservation_date) return alert("예약 날짜를 입력해 주세요.");
    setSaving(r.id);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, ...d }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      setEditing((old) => { const copy = { ...old }; delete copy[r.id]; return copy; });
      setReload((v) => v + 1);
    } catch (e) { alert(e instanceof Error ? e.message : "저장 실패"); }
    finally { setSaving(null); }
  }

  if (authStatus === "loading") return <p style={{ padding: 20 }}>로그인 확인 중...</p>;
  if (authStatus !== "authenticated") return null;

  return (
    <main style={{ background: "#fff", color: "#111827", minHeight: "100vh", padding: "20px 16px", colorScheme: "light" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ margin: 0, fontSize: 24 }}>예약관리</h1><p style={{ color: "#64748b", marginTop: 6 }}>예약 날짜 기준 월별 달력 · 날짜를 눌러 예약자 확인</p></div>
          <button style={button} onClick={() => router.push(`/${pageLK}/admin/leads${isRoot && landingFilter !== "ALL" ? `?landing_key=${landingFilter}` : ""}`)}>← 리드 관리로 돌아가기</button>
        </div>
        <section style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 20, marginBottom: 16 }}>
          <button style={button} onClick={() => setMonth((v) => shiftMonth(v, -1))}>이전달</button>
          <input type="month" style={field} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button style={button} onClick={() => setMonth((v) => shiftMonth(v, 1))}>다음달</button>
          <select style={field} value={landingFilter} onChange={(e) => setLandingFilter(e.target.value)}>
            <option value="ALL">전체 허용 랜딩</option>
            {enabledKeys.sort((a, b) => Number(a) - Number(b)).map((key) => <option value={key} key={key}>{key} {LABELS[key] ?? ""}</option>)}
          </select>
          <input style={{ ...field, flex: "1 1 180px" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="환자 이름 / 전화번호 검색" />
          <button style={button} onClick={() => setReload((v) => v + 1)}>새로고침</button>
        </section>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <p style={{ fontSize: 13, color: "#64748b" }}>{month} 예약 {filtered.length}건 {loading ? "· 불러오는 중..." : ""}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((n) => <div key={n} style={{ textAlign: "center", padding: 10, background: "#f8fafc", fontWeight: 700 }}>{n}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} style={{ minHeight: 66, background: "#f8fafc" }} />)}
          {Array.from({ length: dayCount }, (_, i) => {
            const d = `${month}-${String(i + 1).padStart(2, "0")}`;
            const count = byDate[d]?.length ?? 0;
            return <button key={d} onClick={() => setDate(d)} style={{ minWidth: 0, minHeight: 66, padding: 7, textAlign: "left", border: "1px solid #f1f5f9", background: date === d ? "#dcfce7" : "#fff", cursor: "pointer", color: "#111827" }}>
              <div style={{ fontWeight: 700 }}>{i + 1}</div>
              {count > 0 && <div style={{ fontSize: 12, marginTop: 5, borderRadius: 6, padding: "3px 4px", background: "#dbeafe", color: "#1d4ed8", overflowWrap: "anywhere" }}>예약 {count}건</div>}
            </button>;
          })}
        </div>
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 19 }}>{date} 예약자 ({selected.length}건)</h2>
          {!loading && selected.length === 0 && <p style={{ color: "#64748b" }}>해당 날짜에 예약자가 없습니다.</p>}
          <div style={{ display: "grid", gap: 12 }}>
            {selected.map((r) => {
              const d = editing[r.id];
              return <article key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 15 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{r.reservation_time?.slice(0, 5) || "시간 미정"} · {r.name || "이름 없음"}</strong>
                  <span style={{ fontSize: 13, color: "#166534" }}>{RESERVATION_LABELS[r.reservation_status || "SCHEDULED"] ?? "예약"}</span>
                </div>
                <p style={{ fontSize: 13, color: "#475569" }}>{r.landing_key} {LABELS[r.landing_key || ""] ?? ""} · {r.phone || "전화번호 없음"}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  <label style={{ display: "grid", gap: 5, fontSize: 13 }}>예약 날짜<input type="date" style={field} value={d?.reservation_date ?? r.reservation_date ?? ""} onChange={(e) => patch(r.id, { reservation_date: e.target.value })} /></label>
                  <label style={{ display: "grid", gap: 5, fontSize: 13 }}>예약 시간<input type="time" style={field} value={d?.reservation_time ?? r.reservation_time?.slice(0, 5) ?? ""} onChange={(e) => patch(r.id, { reservation_time: e.target.value })} /></label>
                  <label style={{ display: "grid", gap: 5, fontSize: 13 }}>예약 상태<select style={field} value={d?.reservation_status ?? r.reservation_status ?? "SCHEDULED"} onChange={(e) => patch(r.id, { reservation_status: e.target.value })}>{Object.entries(RESERVATION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                </div>
                <label style={{ display: "grid", gap: 5, fontSize: 13, marginTop: 12 }}>예약 메모<textarea rows={2} style={{ ...field, resize: "vertical" }} value={d?.reservation_memo ?? r.reservation_memo ?? ""} onChange={(e) => patch(r.id, { reservation_memo: e.target.value })} /></label>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button style={{ ...button, background: d ? "#111827" : "#e5e7eb", color: d ? "white" : "#6b7280" }} disabled={!d || saving === r.id} onClick={() => save(r)}>{saving === r.id ? "저장 중..." : "변경사항 저장"}</button></div>
              </article>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
