"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  memo: string | null;
  landing_key: string | null;
};

type Account = {
  admin_id: string;
  landing_key: string;
  balance: number;
  price_per_lead: number;
  is_active: boolean;
  updated_at?: string | null;
};

const LK_KEYS = Array.from({ length: 21 }, (_, i) => String(i).padStart(2, "0"));

const STATUS_OPTIONS = ["NEW", "BOOKED", "CALLED", "NO_ANSWER", "INVALID"] as const;
type StatusKey = typeof STATUS_OPTIONS[number];
type StatusFilter = "ALL" | StatusKey;

const STATUS_META: Record<StatusKey, { label: string; bg: string; fg: string; bd: string }> = {
  NEW: { label: "신규", bg: "#EEF2FF", fg: "#3730A3", bd: "#C7D2FE" },
  BOOKED: { label: "예약", bg: "#ECFDF5", fg: "#065F46", bd: "#A7F3D0" },
  CALLED: { label: "통화", bg: "#ECFEFF", fg: "#155E75", bd: "#A5F3FC" },
  NO_ANSWER: { label: "부재", bg: "#FEF9C3", fg: "#854D0E", bd: "#FDE68A" },
  INVALID: { label: "불량", bg: "#FEF2F2", fg: "#991B1B", bd: "#FECACA" },
};

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function extractLKFromPath(pathname: string) {
  // "/01/admin/leads" -> "01"
  const m = pathname.match(/^\/(\d{1,2})(\/|$)/);
  return normalizeLK(m?.[1] ?? "00");
}

function fmt(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("ko-KR");
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (String(status ?? "NEW").toUpperCase() as StatusKey) || "NEW";
  const m = STATUS_META[key] ?? STATUS_META.NEW;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: m.bg,
        color: m.fg,
        border: `1px solid ${m.bd}`,
      }}
    >
      {m.label}
    </span>
  );
}

export default function AdminLeadsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const sess = useSession();
  const authStatus = sess?.status;
  const session = sess?.data;

  // ✅ 현재 페이지 LK (/01/admin/leads -> 01)
  const pageLK = useMemo(() => extractLKFromPath(pathname), [pathname]);

  // ✅ 선택 LK: 쿼리 있으면 그걸, 없으면 현재 페이지 LK
  const selectedLK = normalizeLK(sp.get("landing_key") ?? pageLK);

  // ✅ 세션 LK
  const userLK = normalizeLK((session?.user as any)?.landing_key ?? "");
  const canSwitchAny = userLK === "00";

  const [rows, setRows] = useState<Lead[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const [draft, setDraft] = useState<Record<string, { status?: string; memo?: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // 대시보드
  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<any | null>(null);

  // 상태 필터
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // 루트 전용 계정 목록/충전
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [topupAdminId, setTopupAdminId] = useState("");
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [topupNote, setTopupNote] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const visibleKeys = useMemo(() => {
    if (canSwitchAny) return LK_KEYS;
    if (userLK) return [userLK];
    return [pageLK];
  }, [canSwitchAny, userLK, pageLK]);

  const statusCounts = useMemo(() => {
    if (stats?.counts?.status) return stats.counts.status as Record<string, number>;
    const base: Record<string, number> = {};
    for (const r of rows) {
      const k = String(r.status ?? "NEW").toUpperCase();
      base[k] = (base[k] ?? 0) + 1;
    }
    return base;
  }, [stats, rows]);

  const displayRows = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    return rows.filter((r) => String(r.status ?? "NEW").toUpperCase() === statusFilter);
  }, [rows, statusFilter]);

  function setLandingKey(k: string) {
    const p = new URLSearchParams(sp.toString());
    p.set("landing_key", normalizeLK(k));

    // ✅ 중요한 수정: /admin/leads 고정 X, 현재 라우트(/01/admin/leads) 기준으로 이동
    router.push(`/${pageLK}/admin/leads?${p.toString()}`);
    router.refresh();
  }

  async function saveLead(id: string) {
    const d = draft[id] || {};
    const body: any = {};
    if (typeof d.status === "string") body.status = d.status;
    if (typeof d.memo === "string") body.memo = d.memo;
    if (Object.keys(body).length === 0) return;

    setSaving((m) => ({ ...m, [id]: true }));
    setErr(null);

    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "error"}`);
        return;
      }

      const item: Lead | undefined = json?.item;
      if (item?.id) setRows((prev) => prev.map((r) => (r.id === item.id ? item : r)));

      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      setErr("NETWORK_ERROR");
    } finally {
      setSaving((m) => ({ ...m, [id]: false }));
    }
  }

  // ✅ 리드 + 통계 + 계정 로드
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      // ✅ 랜딩별 로그인으로 보내야 landingKey가 유지됨
      router.replace(`/${pageLK}/admin/login`);
      return;
    }
    if (authStatus !== "authenticated") return;

    const ac = new AbortController();

    (async () => {
      setErr(null);
      setLoadingRows(true);

      try {
        const [leadsRes, statsRes, accRes] = await Promise.all([
          fetch(`/api/admin/leads?landing_key=${encodeURIComponent(selectedLK)}`, {
            cache: "no-store",
            signal: ac.signal,
          }),
          fetch(`/api/admin/stats?landing_key=${encodeURIComponent(selectedLK)}`, {
            cache: "no-store",
            signal: ac.signal,
          }),
          fetch(`/api/admin/accounts?landing_key=${encodeURIComponent(selectedLK)}`, {
            cache: "no-store",
            signal: ac.signal,
          }),
        ]);

        const leadsJson = await leadsRes.json().catch(() => ({}));
        const statsJson = await statsRes.json().catch(() => ({}));
        const accJson = await accRes.json().catch(() => ({}));

        if (!leadsRes.ok) {
          setErr(`${leadsRes.status} ${leadsJson?.error || "error"}`);
          setRows([]);
        } else {
          setRows((leadsJson.items || leadsJson.data || []) as Lead[]);
          setDraft({});
        }

        setStats(statsRes.ok ? statsJson : null);
        setAccount(accRes.ok ? ((accJson.item || null) as Account | null) : null);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setErr("NETWORK_ERROR");
          setRows([]);
          setStats(null);
          setAccount(null);
        }
      } finally {
        setLoadingRows(false);
      }
    })();

    return () => ac.abort();
  }, [authStatus, router, selectedLK, pageLK]);

  // ✅ 루트(00)일 때 계정 전체 리스트 로드
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (userLK !== "00") return;

    const ac = new AbortController();
    (async () => {
      setAccountsLoading(true);
      try {
        const res = await fetch("/api/admin/accounts", { cache: "no-store", signal: ac.signal });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setAccounts((json.items || []) as Account[]);
      } catch {
        // ignore
      } finally {
        setAccountsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [authStatus, userLK]);

  async function refreshAccountsList() {
    if (userLK !== "00") return;
    const res = await fetch("/api/admin/accounts", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setAccounts((json.items || []) as Account[]);
  }

  async function doTopup() {
    if (userLK !== "00") return;

    const admin_id = topupAdminId.trim();
    const amount = safeNumber(topupAmount, 0);
    const note = topupNote.trim();

    if (!admin_id || amount <= 0) {
      alert("admin_id / 금액 입력");
      return;
    }

    setTopupLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/accounts/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id, amount, note }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "충전 실패");
        return;
      }

      alert("충전 완료");
      setTopupAdminId("");
      setTopupAmount(0);
      setTopupNote("");

      await refreshAccountsList();

      if (account?.admin_id === admin_id) {
        const res2 = await fetch(`/api/admin/accounts?landing_key=${encodeURIComponent(selectedLK)}`, { cache: "no-store" });
        const j2 = await res2.json().catch(() => ({}));
        if (res2.ok) setAccount(j2.item || null);
      }
    } finally {
      setTopupLoading(false);
    }
  }

  async function saveAccountSetting(admin_id: string, landing_key: string, price_per_lead: number, is_active: boolean) {
    if (userLK !== "00") return;

    const res = await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_id, landing_key, price_per_lead, is_active }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "저장 실패");
      return;
    }

    await refreshAccountsList();

    if (landing_key === selectedLK) {
      const res2 = await fetch(`/api/admin/accounts?landing_key=${encodeURIComponent(selectedLK)}`, { cache: "no-store" });
      const j2 = await res2.json().catch(() => ({}));
      if (res2.ok) setAccount(j2.item || null);
    }
  }

  if (!authStatus || authStatus === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Admin Leads</h1>
          <p style={{ opacity: 0.7, marginTop: 6, marginBottom: 0 }}>
            user: {(session?.user as any)?.email} / my_landing_key: {userLK || "-"} / page_lk: {pageLK}
          </p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: `/${pageLK}/admin/login` })}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
        >
          로그아웃
        </button>
      </div>

      {/* landing_key 선택 */}
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visibleKeys.map((k) => (
          <button
            key={k}
            onClick={() => setLandingKey(k)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              fontWeight: k === selectedLK ? 900 : 600,
              background: k === selectedLK ? "#111" : "#fff",
              color: k === selectedLK ? "#fff" : "#111",
              cursor: "pointer",
            }}
            title={canSwitchAny ? "landing_key 변경" : "권한: 본인 landing_key만"}
          >
            {k}
          </button>
        ))}
      </div>

      {/* 대시보드 카드 */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div style={card}>
          잔액
          <div style={cardBig}>{fmt(account?.balance)}</div>
        </div>
        <div style={card}>
          리드 단가
          <div style={cardBig}>{fmt(account?.price_per_lead)}</div>
        </div>
        <div style={card}>
          오늘 리드
          <div style={cardBig}>{fmt(stats?.counts?.today)}</div>
        </div>
        <div style={card}>
          이번달 리드
          <div style={cardBig}>{fmt(stats?.counts?.month)}</div>
        </div>
      </div>

      {/* 상태 탭 */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["ALL", ...STATUS_OPTIONS] as const).map((s) => {
          const active = statusFilter === (s as any);
          const label = s === "ALL" ? "전체" : STATUS_META[s].label;
          const count = s === "ALL" ? rows.length : (statusCounts?.[s] ?? 0);

          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s as StatusFilter)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                fontWeight: active ? 900 : 600,
                background: active ? "#111" : "#fff",
                color: active ? "#fff" : "#111",
                cursor: "pointer",
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {err && (
        <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </p>
      )}

      {/* 루트(00) 충전/단가 설정 */}
      {userLK === "00" && (
        <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h3 style={{ margin: 0, fontWeight: 900 }}>Root: 충전 / 단가 설정</h3>
            <button
              onClick={refreshAccountsList}
              style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
            >
              목록 새로고침
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <input
              placeholder="admin_id (admin01)"
              value={topupAdminId}
              onChange={(e) => setTopupAdminId(e.target.value)}
              style={inp}
            />
            <input
              placeholder="충전 금액"
              type="number"
              value={topupAmount ? String(topupAmount) : ""}
              onChange={(e) => setTopupAmount(Number(e.target.value))}
              style={inp}
            />
            <input
              placeholder="메모(선택)"
              value={topupNote}
              onChange={(e) => setTopupNote(e.target.value)}
              style={inp}
            />
            <button
              onClick={doTopup}
              disabled={topupLoading}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#111", color: "#fff" }}
            >
              {topupLoading ? "충전중..." : "충전"}
            </button>
          </div>

          <div style={{ marginTop: 12, opacity: accountsLoading ? 0.6 : 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>admin</th>
                  <th style={th}>LK</th>
                  <th style={th}>잔액</th>
                  <th style={th}>단가</th>
                  <th style={th}>활성</th>
                  <th style={th}>저장</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <AccountRow key={a.admin_id} a={a} onSave={saveAccountSetting} />
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 12, color: "#666" }}>
                      계정 없음 (admin_accounts 테이블에 seed 필요)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 리드 테이블 */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 800 }}>
          landing_key: {selectedLK} • {loadingRows ? "불러오는 중..." : `${displayRows.length}건`}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>시간</th>
              <th style={th}>이름</th>
              <th style={th}>전화</th>
              <th style={th}>상태</th>
              <th style={th}>메모</th>
              <th style={th}>저장</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((l) => {
              const d = draft[l.id] || {};
              const curStatus = (d.status ?? l.status ?? "NEW") as StatusKey;
              const curMemo = (d.memo ?? l.memo ?? "") as string;

              const changed =
                (d.status !== undefined && d.status !== (l.status ?? "NEW")) ||
                (d.memo !== undefined && d.memo !== (l.memo ?? ""));

              return (
                <tr key={l.id}>
                  <td style={td}>{new Date(l.created_at).toLocaleString("ko-KR")}</td>
                  <td style={td}>{l.name ?? "-"}</td>
                  <td style={td}>{l.phone ?? "-"}</td>

                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StatusBadge status={curStatus} />
                      <select
                        value={curStatus}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [l.id]: { ...prev[l.id], status: e.target.value },
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  <td style={td}>
                    <input
                      value={curMemo}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], memo: e.target.value },
                        }))
                      }
                      placeholder="메모"
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td style={td}>
                    <button
                      onClick={() => saveLead(l.id)}
                      disabled={!changed || !!saving[l.id]}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: changed ? "#111" : "#f3f3f3",
                        color: changed ? "#fff" : "#999",
                        cursor: changed ? "pointer" : "not-allowed",
                      }}
                    >
                      {saving[l.id] ? "저장중..." : "저장"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loadingRows && displayRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "#666" }}>
                  데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountRow({
  a,
  onSave,
}: {
  a: Account;
  onSave: (admin_id: string, landing_key: string, price_per_lead: number, is_active: boolean) => Promise<void>;
}) {
  const [price, setPrice] = useState<number>(safeNumber(a.price_per_lead, 0));
  const [active, setActive] = useState<boolean>(!!a.is_active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(safeNumber(a.price_per_lead, 0));
    setActive(!!a.is_active);
  }, [a.price_per_lead, a.is_active]);

  return (
    <tr>
      <td style={td}>{a.admin_id}</td>
      <td style={td}>{a.landing_key}</td>
      <td style={td}>{fmt(a.balance)}</td>
      <td style={td}>
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: 120 }} />
      </td>
      <td style={td}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </td>
      <td style={td}>
        <button
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(a.admin_id, a.landing_key, safeNumber(price, 0), active);
            } finally {
              setSaving(false);
            }
          }}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          disabled={saving}
        >
          {saving ? "저장중..." : "저장"}
        </button>
      </td>
    </tr>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
};

const cardBig: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  marginTop: 6,
};

const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #eee",
  fontSize: 13,
  color: "#444",
  background: "#fafafa",
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f3f3f3",
  fontSize: 14,
};