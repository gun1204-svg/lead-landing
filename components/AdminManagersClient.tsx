"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type LeadManager = {
  id: string;
  owner_landing_key: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

const LK_KEYS = Array.from({ length: 21 }, (_, i) => String(i).padStart(2, "0"));

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

function extractLKFromPath(pathname: string) {
  const m = pathname.match(/^\/(\d{1,2})(\/|$)/);
  return normalizeLK(m?.[1] ?? "00");
}

function getManagerOwnerLK(userLK: string, selectedLK: string) {
  if (userLK !== "00") return userLK;

  const lk = normalizeLK(selectedLK);

  // 현재 02 어드민이 02/03/04를 통합 관리하므로 담당자도 02 기준으로 묶음
  if (["02", "03", "04"].includes(lk)) return "02";

  return lk;
}

export default function AdminManagersClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const sess = useSession();
  const authStatus = sess?.status;
  const session = sess?.data;

  const pageLK = useMemo(() => extractLKFromPath(pathname), [pathname]);
  const userLK = normalizeLK((session?.user as any)?.landing_key ?? "");
  const canSwitchAny = userLK === "00";
  const selectedLK = normalizeLK(sp.get("landing_key") ?? pageLK);
  const managerOwnerLK = getManagerOwnerLK(userLK, selectedLK);

  const [managers, setManagers] = useState<LeadManager[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newManagerName, setNewManagerName] = useState("");
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [editingManagerName, setEditingManagerName] = useState("");

  function goLeadsPage() {
    const q = canSwitchAny ? `?landing_key=${encodeURIComponent(selectedLK)}` : "";
    router.push(`/${pageLK}/admin/leads${q}`);
  }

  function setLandingKey(k: string) {
    const nk = normalizeLK(k);
    const p = new URLSearchParams(sp.toString());
    p.set("landing_key", nk);
    router.push(`/${pageLK}/admin/managers?${p.toString()}`);
    router.refresh();
  }

  async function loadManagers(signal?: AbortSignal) {
    if (!managerOwnerLK) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        `/api/admin/managers?owner_landing_key=${encodeURIComponent(managerOwnerLK)}`,
        { cache: "no-store", signal }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setManagers([]);
        if (!signal?.aborted) {
          setErr(`${res.status} ${json?.error || "담당자 목록 불러오기 실패"}`);
        }
        return;
      }

      setManagers((json.items || []) as LeadManager[]);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setManagers([]);
        setErr("MANAGER_NETWORK_ERROR");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/${pageLK}/admin/login`);
      return;
    }

    if (authStatus !== "authenticated") return;

    const ac = new AbortController();
    loadManagers(ac.signal);

    return () => ac.abort();
  }, [authStatus, pageLK, managerOwnerLK]);

  async function addManager() {
    const name = newManagerName.trim();

    if (!name) {
      alert("담당자 이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_landing_key: managerOwnerLK,
          name,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json?.error || "담당자 추가 실패");
        return;
      }

      setNewManagerName("");
      await loadManagers();
    } finally {
      setLoading(false);
    }
  }

  async function updateManagerName(id: string) {
    const name = editingManagerName.trim();

    if (!name) {
      alert("담당자 이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/managers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json?.error || "담당자 이름 수정 실패");
        return;
      }

      setEditingManagerId(null);
      setEditingManagerName("");
      await loadManagers();
    } finally {
      setLoading(false);
    }
  }

  async function toggleManagerActive(id: string, active: boolean) {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/managers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json?.error || "담당자 상태 변경 실패");
        return;
      }

      await loadManagers();
    } finally {
      setLoading(false);
    }
  }

  if (!authStatus || authStatus === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>담당자 관리</h1>

          <p style={{ opacity: 0.7, marginTop: 6, marginBottom: 0 }}>
            user: {(session?.user as any)?.email} / my_landing_key: {userLK || "-"} / page_lk: {pageLK} / owner_landing_key: {managerOwnerLK}
          </p>

          {["02", "03", "04"].includes(selectedLK) && managerOwnerLK === "02" && (
            <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 800, color: "#0f766e" }}>
              02·03·04번 담당자는 02번 기준으로 통합 관리됩니다.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={goLeadsPage} style={blackBtn}>
            리드 목록
          </button>

          <button
            onClick={() => signOut({ callbackUrl: `/${pageLK}/admin/login` })}
            style={smallBtn}
          >
            로그아웃
          </button>
        </div>
      </div>

      {canSwitchAny && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LK_KEYS.map((k) => (
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
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {err && <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</p>}

      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}>
        <h3 style={{ marginTop: 0, marginBottom: 10, fontWeight: 900 }}>새 담당자 추가</h3>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newManagerName}
            onChange={(e) => setNewManagerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addManager();
            }}
            placeholder="새 담당자 이름"
            style={inp}
          />

          <button onClick={addManager} disabled={loading} style={blackBtn}>
            {loading ? "처리중..." : "추가"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 900 }}>
          담당자 목록 • {loading ? "불러오는 중..." : `${managers.length}명`}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>담당자</th>
              <th style={th}>상태</th>
              <th style={th}>관리 기준</th>
              <th style={th}>생성일</th>
              <th style={th}>수정</th>
              <th style={th}>활성/비활성</th>
            </tr>
          </thead>

          <tbody>
            {managers.map((m) => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.6 }}>
                <td style={td}>
                  {editingManagerId === m.id ? (
                    <input
                      value={editingManagerName}
                      onChange={(e) => setEditingManagerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateManagerName(m.id);
                      }}
                      style={{ ...inp, width: 160 }}
                    />
                  ) : (
                    <strong>{m.name}</strong>
                  )}
                </td>

                <td style={td}>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: m.active ? "#ECFDF5" : "#F3F4F6",
                      color: m.active ? "#065F46" : "#6B7280",
                      border: m.active ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                    }}
                  >
                    {m.active ? "활성" : "비활성"}
                  </span>
                </td>

                <td style={td}>{m.owner_landing_key}</td>
                <td style={td}>{m.created_at ? new Date(m.created_at).toLocaleString("ko-KR") : "-"}</td>

                <td style={td}>
                  {editingManagerId === m.id ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => updateManagerName(m.id)} disabled={loading} style={blackBtn}>
                        저장
                      </button>

                      <button
                        onClick={() => {
                          setEditingManagerId(null);
                          setEditingManagerName("");
                        }}
                        disabled={loading}
                        style={smallBtn}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingManagerId(m.id);
                        setEditingManagerName(m.name);
                      }}
                      disabled={loading}
                      style={smallBtn}
                    >
                      이름수정
                    </button>
                  )}
                </td>

                <td style={td}>
                  <button
                    onClick={() => toggleManagerActive(m.id, !m.active)}
                    disabled={loading}
                    style={smallBtn}
                  >
                    {m.active ? "비활성" : "활성"}
                  </button>
                </td>
              </tr>
            ))}

            {!loading && managers.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "#666" }}>
                  등록된 담당자가 없습니다. 새 담당자를 추가해주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  fontWeight: 800,
};

const smallBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
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
