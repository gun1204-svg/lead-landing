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
  utm_source?: string | null;
};

type Account = {
  admin_id: string;
  landing_key: string;
  balance: number;
  price_per_lead: number;
  is_active: boolean;
  updated_at?: string | null;
};

type PermissionRow = {
  admin_id: string;
  landing_key: string;
};

type ViewSetting = {
  admin_id: string;
  default_landing_key: string;
  show_combined_leads: boolean;
  show_landing_compare: boolean;
  can_edit_allowed_leads: boolean;
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

function countToday(rows: Lead[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  return rows.filter((r) => {
    const dt = new Date(r.created_at);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  }).length;
}

function countMonth(rows: Lead[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return rows.filter((r) => {
    const dt = new Date(r.created_at);
    return dt.getFullYear() === y && dt.getMonth() === m;
  }).length;
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

function LandingBadge({ landingKey }: { landingKey: string | null }) {
  const lk = normalizeLK(landingKey ?? "");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: lk === "03" ? "#FFF7ED" : "#F0FDFA",
        color: lk === "03" ? "#9A3412" : "#0F766E",
        border: lk === "03" ? "1px solid #FED7AA" : "1px solid #99F6E4",
      }}
    >
      {lk}번
    </span>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  const raw = String(source || "").trim();
  const s = raw.toLowerCase();

  let label = raw || "-";

  if (s.includes("meta") || s.includes("facebook") || s.includes("instagram")) {
    label = "메타";
  } else if (s.includes("karrot") || s.includes("daangn") || s.includes("danggeun")) {
    label = "당근";
  } else if (s.includes("naver")) {
    label = "네이버";
  } else if (s.includes("tiktok")) {
    label = "틱톡";
  } else if (s.includes("google")) {
    label = "구글";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: "#F3F4F6",
        color: "#111",
        border: "1px solid #E5E7EB",
      }}
    >
      {label}
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

  const pageLK = useMemo(() => extractLKFromPath(pathname), [pathname]);
  const isMainAdmin = pageLK === "00";

  const userLK = normalizeLK((session?.user as any)?.landing_key ?? "");
  const canSwitchAny = userLK === "00";
  const selectedLK = normalizeLK(sp.get("landing_key") ?? pageLK);

  const [rows, setRows] = useState<Lead[]>([]);
  const [allRows, setAllRows] = useState<Lead[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const [allowedLandingKeys, setAllowedLandingKeys] = useState<string[]>([pageLK]);

  const [draft, setDraft] = useState<Record<string, { status?: string; memo?: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const [account, setAccount] = useState<Account | null>(null);
  const [integratedAccounts, setIntegratedAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<any | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [topupAdminId, setTopupAdminId] = useState("");
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [topupNote, setTopupNote] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [viewSettings, setViewSettings] = useState<ViewSetting[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const isIntegratedAdmin = !canSwitchAny && allowedLandingKeys.length > 1;

  const visibleKeys = useMemo(() => {
    if (canSwitchAny) return LK_KEYS;
    return allowedLandingKeys.length ? allowedLandingKeys : [pageLK];
  }, [canSwitchAny, allowedLandingKeys, pageLK]);

  const totalBalance = useMemo(() => {
    if (isIntegratedAdmin) {
      return integratedAccounts.reduce((sum, a) => sum + safeNumber(a.balance, 0), 0);
    }
    return safeNumber(account?.balance, 0);
  }, [isIntegratedAdmin, integratedAccounts, account]);

  const leadsByLanding = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const r of rows) {
      const lk = normalizeLK(r.landing_key);
      if (!map[lk]) map[lk] = [];
      map[lk].push(r);
    }
    return map;
  }, [rows]);

  const statusCounts = useMemo(() => {
    const base: Record<string, number> = {};
    for (const r of rows) {
      const k = String(r.status ?? "NEW").toUpperCase();
      base[k] = (base[k] ?? 0) + 1;
    }
    return base;
  }, [rows]);

  const displayRows = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    return rows.filter((r) => String(r.status ?? "NEW").toUpperCase() === statusFilter);
  }, [rows, statusFilter]);

  const todayCount = useMemo(() => countToday(rows), [rows]);
  const monthCount = useMemo(() => countMonth(rows), [rows]);

  const totalTodayCount = useMemo(() => countToday(allRows), [allRows]);
  const totalMonthCount = useMemo(() => countMonth(allRows), [allRows]);
  const totalAllCount = useMemo(() => allRows.length, [allRows]);

  function setLandingKey(k: string) {
    const nk = normalizeLK(k);

    const p = new URLSearchParams(sp.toString());
    p.set("landing_key", nk);

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
      if (item?.id) {
        setRows((prev) => prev.map((r) => (r.id === item.id ? item : r)));
        setAllRows((prev) => prev.map((r) => (r.id === item.id ? item : r)));
      }

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

  async function deleteLead(id: string) {
    if (!isMainAdmin) return;

    const ok = window.confirm("이 리드를 삭제하시겠습니까?");
    if (!ok) return;

    setDeleting((m) => ({ ...m, [id]: true }));
    setErr(null);

    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "error"}`);
        return;
      }

      setRows((prev) => prev.filter((r) => r.id !== id));
      setAllRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      setErr("NETWORK_ERROR");
    } finally {
      setDeleting((m) => ({ ...m, [id]: false }));
    }
  }

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/${pageLK}/admin/login`);
      return;
    }

    if (authStatus !== "authenticated") return;

    const ac = new AbortController();

    (async () => {
      setErr(null);
      setLoadingRows(true);

      try {
        if (!canSwitchAny) {
          const leadsRes = await fetch("/api/admin/leads", {
            cache: "no-store",
            signal: ac.signal,
          });

          const leadsJson = await leadsRes.json().catch(() => ({}));

          if (!leadsRes.ok) {
            setErr(`${leadsRes.status} ${leadsJson?.error || "error"}`);
            setRows([]);
            setAllowedLandingKeys([pageLK]);
            return;
          }

          const keys: string[] = Array.isArray(leadsJson.allowed_landing_keys)
            ? leadsJson.allowed_landing_keys.map((v: any) => normalizeLK(v))
            : [pageLK];

          const uniqueKeys: string[] = Array.from(
              new Set<string>(keys.length ? keys : [pageLK])
          );

          setAllowedLandingKeys(uniqueKeys);
          setRows((leadsJson.items || leadsJson.data || []) as Lead[]);
          setDraft({});
          setStats(null);

          const accountResults = await Promise.all(
            uniqueKeys.map((lk) =>
              fetch(`/api/admin/accounts?landing_key=${encodeURIComponent(lk)}`, {
                cache: "no-store",
                signal: ac.signal,
              }).then(async (res) => ({
                res,
                json: await res.json().catch(() => ({})),
              }))
            )
          );

          const mergedAccounts: Account[] = [];
          for (const item of accountResults) {
            if (item.res.ok && item.json?.item) {
              mergedAccounts.push(item.json.item as Account);
            }
          }

          setIntegratedAccounts(mergedAccounts);
          setAccount(mergedAccounts[0] || null);
          return;
        }

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

        setAllowedLandingKeys([selectedLK]);
        setStats(statsRes.ok ? statsJson : null);
        setAccount(accRes.ok ? ((accJson.item || null) as Account | null) : null);
        setIntegratedAccounts([]);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setErr("NETWORK_ERROR");
          setRows([]);
          setStats(null);
          setAccount(null);
          setIntegratedAccounts([]);
        }
      } finally {
        setLoadingRows(false);
      }
    })();

    return () => ac.abort();
  }, [authStatus, router, selectedLK, pageLK, canSwitchAny]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (!isMainAdmin) return;

    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/admin/leads", {
          cache: "no-store",
          signal: ac.signal,
        });

        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setAllRows((json.items || json.data || []) as Lead[]);
        } else {
          setAllRows([]);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setAllRows([]);
        }
      }
    })();

    return () => ac.abort();
  }, [authStatus, isMainAdmin]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (userLK !== "00") return;

    const ac = new AbortController();

    (async () => {
      setAccountsLoading(true);

      try {
        const res = await fetch("/api/admin/accounts", {
          cache: "no-store",
          signal: ac.signal,
        });

        const json = await res.json().catch(() => ({}));
        if (res.ok) setAccounts((json.items || []) as Account[]);
      } catch {
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

  async function refreshPermissions() {
    if (userLK !== "00") return;

    setPermissionsLoading(true);

    try {
      const res = await fetch("/api/admin/permissions", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "권한 목록 불러오기 실패"}`);
        return;
      }

      setPermissions((json.permissions || []) as PermissionRow[]);
      setViewSettings((json.settings || []) as ViewSetting[]);
    } finally {
      setPermissionsLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (userLK !== "00") return;
    refreshPermissions();
  }, [authStatus, userLK]);

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
    } finally {
      setTopupLoading(false);
    }
  }

  async function saveAccountSetting(
    admin_id: string,
    landing_key: string,
    price_per_lead: number,
    is_active: boolean
  ) {
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
  }

  if (!authStatus || authStatus === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Admin Leads</h1>

          <p style={{ opacity: 0.7, marginTop: 6, marginBottom: 0 }}>
            user: {(session?.user as any)?.email} / my_landing_key: {userLK || "-"} / page_lk: {pageLK}
          </p>

          {isIntegratedAdmin && (
            <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 800, color: "#0f766e" }}>
              통합 관리: {allowedLandingKeys.join(" + ")}번 리드 / 잔액 합산 표시
            </p>
          )}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: `/${pageLK}/admin/login` })}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
        >
          로그아웃
        </button>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visibleKeys.map((k) => (
          <button
            key={k}
            onClick={() => setLandingKey(k)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              fontWeight: k === selectedLK || (!canSwitchAny && allowedLandingKeys.includes(k)) ? 900 : 600,
              background: k === selectedLK || (!canSwitchAny && allowedLandingKeys.includes(k)) ? "#111" : "#fff",
              color: k === selectedLK || (!canSwitchAny && allowedLandingKeys.includes(k)) ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: isIntegratedAdmin
            ? `repeat(${Math.min(7, Math.max(4, allowedLandingKeys.length + 3))}, minmax(0, 1fr))`
            : "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div style={card}>
          {isIntegratedAdmin ? "통합 잔액" : "잔액"}
          <div style={cardBig}>{fmt(totalBalance)}</div>
        </div>

        {isIntegratedAdmin ? (
          <>
            {allowedLandingKeys.map((lk) => {
              const acc = integratedAccounts.find((a) => normalizeLK(a.landing_key) === lk);
              const leadRows = leadsByLanding[lk] || [];

              return (
                <div key={lk} style={card}>
                  {lk} 리드
                  <div style={cardBig}>
                    오늘 {fmt(countToday(leadRows))} / 월 {fmt(countMonth(leadRows))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                    단가 {fmt(acc?.price_per_lead)}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div style={card}>
            리드 단가
            <div style={cardBig}>{fmt(account?.price_per_lead)}</div>
          </div>
        )}

        <div style={card}>
          오늘 리드
          <div style={cardBig}>{fmt(stats?.counts?.today ?? todayCount)}</div>
        </div>

        <div style={card}>
          이번달 리드
          <div style={cardBig}>{fmt(stats?.counts?.month ?? monthCount)}</div>
        </div>
      </div>

      {isMainAdmin && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div style={card}>
            전체 오늘 리드
            <div style={cardBig}>{fmt(totalTodayCount)}</div>
          </div>

          <div style={card}>
            전체 이번달 리드
            <div style={cardBig}>{fmt(totalMonthCount)}</div>
          </div>

          <div style={card}>
            전체 누적 리드
            <div style={cardBig}>{fmt(totalAllCount)}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["ALL", ...STATUS_OPTIONS] as const).map((s) => {
          const active = statusFilter === (s as any);
          const label = s === "ALL" ? "전체" : STATUS_META[s].label;
          const count = s === "ALL" ? rows.length : statusCounts?.[s] ?? 0;

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

      {err && <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</p>}

      {userLK === "00" && (
        <>
          <RootPermissionsBox
            accounts={accounts}
            permissions={permissions}
            viewSettings={viewSettings}
            loading={permissionsLoading}
            onRefresh={refreshPermissions}
          />

          <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <h3 style={{ margin: 0, fontWeight: 900 }}>Root: 충전 / 단가 설정</h3>

              <button onClick={refreshAccountsList} style={smallBtn}>
                목록 새로고침
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <input placeholder="admin_id (admin01)" value={topupAdminId} onChange={(e) => setTopupAdminId(e.target.value)} style={inp} />
              <input placeholder="충전 금액" type="number" value={topupAmount ? String(topupAmount) : ""} onChange={(e) => setTopupAmount(Number(e.target.value))} style={inp} />
              <input placeholder="메모(선택)" value={topupNote} onChange={(e) => setTopupNote(e.target.value)} style={inp} />

              <button onClick={doTopup} disabled={topupLoading} style={blackBtn}>
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
                    <AccountRow key={`${a.admin_id}-${a.landing_key}`} a={a} onSave={saveAccountSetting} />
                  ))}

                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 12, color: "#666" }}>
                        계정 없음
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 800 }}>
          {isIntegratedAdmin
            ? `landing_key: ${allowedLandingKeys.join(" + ")} 통합 • ${loadingRows ? "불러오는 중..." : `${displayRows.length}건`}`
            : `landing_key: ${selectedLK} • ${loadingRows ? "불러오는 중..." : `${displayRows.length}건`}`}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>시간</th>
              <th style={th}>랜딩</th>
              <th style={th}>유입</th>
              <th style={th}>이름</th>
              <th style={th}>전화</th>
              <th style={th}>상태</th>
              <th style={th}>메모</th>
              <th style={th}>저장</th>
              {isMainAdmin && <th style={th}>삭제</th>}
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
                  <td style={tdTop}>{new Date(l.created_at).toLocaleString("ko-KR")}</td>
                  <td style={tdTop}><LandingBadge landingKey={l.landing_key} /></td>
                  <td style={tdTop}><SourceBadge source={l.utm_source} /></td>
                  <td style={tdTop}>{l.name ?? "-"}</td>
                  <td style={tdTop}>{l.phone ?? "-"}</td>

                  <td style={tdTop}>
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

                  <td style={{ ...tdTop, minWidth: 320 }}>
                    <textarea
                      value={curMemo}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], memo: e.target.value },
                        }))
                      }
                      placeholder="메모"
                      rows={4}
                      style={{
                        width: "100%",
                        minHeight: 96,
                        resize: "vertical",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                      }}
                    />
                  </td>

                  <td style={tdTop}>
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

                  {isMainAdmin && (
                    <td style={tdTop}>
                      <button
                        onClick={() => deleteLead(l.id)}
                        disabled={!!deleting[l.id]}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #f1c0c0",
                          background: "#fff5f5",
                          color: "#b91c1c",
                          cursor: deleting[l.id] ? "not-allowed" : "pointer",
                        }}
                      >
                        {deleting[l.id] ? "삭제중..." : "삭제"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {!loadingRows && displayRows.length === 0 && (
              <tr>
                <td colSpan={isMainAdmin ? 9 : 8} style={{ padding: 14, color: "#666" }}>
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

function RootPermissionsBox({
  accounts,
  permissions,
  viewSettings,
  loading,
  onRefresh,
}: {
  accounts: Account[];
  permissions: PermissionRow[];
  viewSettings: ViewSetting[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const adminIds = useMemo(() => {
    return Array.from(
      new Set(accounts.map((a) => a.admin_id).filter((id) => id && id !== "admin"))
    ).sort();
  }, [accounts]);

  return (
    <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ margin: 0, fontWeight: 900 }}>Root: 어드민 권한 설정</h3>

        <button onClick={onRefresh} style={smallBtn}>
          {loading ? "불러오는 중..." : "권한 새로고침"}
        </button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        {adminIds.map((adminId) => {
          const allowed = permissions
            .filter((p) => p.admin_id === adminId)
            .map((p) => normalizeLK(p.landing_key));

          const setting = viewSettings.find((s) => s.admin_id === adminId);

          return (
            <PermissionEditor
              key={adminId}
              adminId={adminId}
              initialLandingKeys={allowed.length ? allowed : [normalizeLK(adminId.replace("admin", ""))]}
              initialSetting={setting}
              onSaved={onRefresh}
            />
          );
        })}

        {adminIds.length === 0 && (
          <div style={{ padding: 12, color: "#666" }}>
            계정이 없습니다. 먼저 accounts에 admin02/admin03 계정이 있어야 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionEditor({
  adminId,
  initialLandingKeys,
  initialSetting,
  onSaved,
}: {
  adminId: string;
  initialLandingKeys: string[];
  initialSetting?: ViewSetting;
  onSaved: () => Promise<void>;
}) {
  const fallbackLK = normalizeLK(adminId.replace("admin", ""));
  const initialKeys = Array.from(new Set(initialLandingKeys.length ? initialLandingKeys : [fallbackLK]));

  const [landingKeys, setLandingKeys] = useState<string[]>(initialKeys);
  const [defaultLK, setDefaultLK] = useState(normalizeLK(initialSetting?.default_landing_key ?? initialKeys[0] ?? fallbackLK));
  const [showCombined, setShowCombined] = useState(!!initialSetting?.show_combined_leads);
  const [showCompare, setShowCompare] = useState(initialSetting?.show_landing_compare !== false);
  const [canEdit, setCanEdit] = useState(initialSetting?.can_edit_allowed_leads !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const keys = Array.from(new Set(initialLandingKeys.length ? initialLandingKeys : [fallbackLK]));
    setLandingKeys(keys);
    setDefaultLK(normalizeLK(initialSetting?.default_landing_key ?? keys[0] ?? fallbackLK));
    setShowCombined(!!initialSetting?.show_combined_leads);
    setShowCompare(initialSetting?.show_landing_compare !== false);
    setCanEdit(initialSetting?.can_edit_allowed_leads !== false);
  }, [initialLandingKeys.join(","), initialSetting?.admin_id, initialSetting?.updated_at]);

  function toggleLK(lk: string) {
    setLandingKeys((prev) => {
      const exists = prev.includes(lk);
      const next = exists ? prev.filter((x) => x !== lk) : [...prev, lk].sort();

      if (next.length === 0) return prev;
      if (!next.includes(defaultLK)) setDefaultLK(next[0]);

      return next;
    });
  }

  async function save() {
    if (!landingKeys.includes(defaultLK)) {
      alert("기본 랜딩은 접근 가능 랜딩에 포함되어야 합니다.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: adminId,
          landing_keys: landingKeys,
          default_landing_key: defaultLK,
          show_combined_leads: showCombined,
          show_landing_compare: showCompare,
          can_edit_allowed_leads: canEdit,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json?.error || "권한 저장 실패");
        return;
      }

      alert("권한 저장 완료");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <strong>{adminId}</strong>

        <button onClick={save} disabled={saving} style={blackBtn}>
          {saving ? "저장중..." : "권한 저장"}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>접근 가능 랜딩</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LK_KEYS.filter((k) => k !== "00").map((lk) => (
            <label
              key={lk}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: landingKeys.includes(lk) ? "1px solid #111" : "1px solid #ddd",
                background: landingKeys.includes(lk) ? "#111" : "#fff",
                color: landingKeys.includes(lk) ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              <input
                type="checkbox"
                checked={landingKeys.includes(lk)}
                onChange={() => toggleLK(lk)}
              />
              {lk}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 900 }}>기본 랜딩</span>

        <select value={defaultLK} onChange={(e) => setDefaultLK(normalizeLK(e.target.value))}>
          {landingKeys.map((lk) => (
            <option key={lk} value={lk}>
              {lk}
            </option>
          ))}
        </select>

        <label style={checkLabel}>
          <input type="checkbox" checked={showCombined} onChange={(e) => setShowCombined(e.target.checked)} />
          통합 리드 표시
        </label>

        <label style={checkLabel}>
          <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} />
          랜딩별 비교 카드 표시
        </label>

        <label style={checkLabel}>
          <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
          허용 랜딩 수정 가능
        </label>
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
          style={smallBtn}
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

const blackBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

const checkLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
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

const tdTop: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f3f3f3",
  fontSize: 14,
  verticalAlign: "top",
};