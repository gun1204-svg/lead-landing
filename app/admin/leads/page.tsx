"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  memo: string | null;
  landing_key: string | null;
};

const LK_KEYS = Array.from({ length: 21 }, (_, i) => String(i).padStart(2, "0")); // 00~20
const STATUS_OPTIONS = ["NEW", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

export default function AdminLeadsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const sess = useSession();
  const status = sess?.status;
  const session = sess?.data;

  const selectedLK = sp.get("landing_key") ?? "00";
  const userLK = ((session?.user as any)?.landing_key ?? "") as string;

  const [rows, setRows] = useState<Lead[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const canSwitchAny = userLK === "00";

  const visibleKeys = useMemo(() => {
    if (canSwitchAny) return LK_KEYS;
    if (userLK) return [userLK];
    return ["00"];
  }, [canSwitchAny, userLK]);

  // ✅ 로컬 편집 상태(메모/상태)
  const [draft, setDraft] = useState<Record<string, { status?: string; memo?: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  function setLandingKey(k: string) {
    const p = new URLSearchParams(sp.toString());
    p.set("landing_key", k);
    router.push(`/admin/leads?${p.toString()}`);
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
        // 서버 값으로 rows 갱신
        setRows((prev) => prev.map((r) => (r.id === item.id ? item : r)));
      }

      // 드래프트는 저장한 키만 제거
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
      return;
    }
    if (status !== "authenticated") return;

    const ac = new AbortController();

    (async () => {
      setErr(null);
      setLoadingRows(true);

      try {
        const res = await fetch(
          `/api/admin/leads?landing_key=${encodeURIComponent(selectedLK)}`,
          { cache: "no-store", signal: ac.signal }
        );

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setErr(`${res.status} ${json?.error || "error"}`);
          setRows([]);
          return;
        }

        setRows((json.items || []) as Lead[]);
        setDraft({}); // 랜딩 바뀌면 편집값 초기화
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setErr("NETWORK_ERROR");
          setRows([]);
        }
      } finally {
        setLoadingRows(false);
      }
    })();

    return () => ac.abort();
  }, [status, router, selectedLK]);

  if (!status || status === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>Admin Leads</h1>
          <p style={{ opacity: 0.7, marginTop: 4 }}>
            user: {(session?.user as any)?.email} / my_landing_key: {userLK || "-"}
          </p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
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

      {err && (
        <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </p>
      )}

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 800 }}>
          landing_key: {selectedLK} • {loadingRows ? "불러오는 중..." : `${rows.length}건`}
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
            {rows.map((l) => {
              const d = draft[l.id] || {};
              const curStatus = (d.status ?? l.status ?? "NEW") as string;
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
                          {s}
                        </option>
                      ))}
                    </select>
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

            {!loadingRows && rows.length === 0 && (
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