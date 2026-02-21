"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

const STATUS_OPTIONS = [
  { value: "NEW", label: "NEW" },
  { value: "CONTACTED", label: "연락완료" },
  { value: "NO_ANSWER", label: "부재" },
  { value: "DONE", label: "완료" },
  { value: "SPAM", label: "스팸" },
];

export default function AdminLeads() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const res = await fetch("/api/admin/leads", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      alert("로그인 필요");
      window.location.href = "/admin/login";
      return;
    }

    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }

  async function saveRow(id: string, status: string, memo: string) {
    setSavingId(id);

    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, memo }),
    });

    if (!res.ok) {
      setSavingId(null);
      alert("저장 실패");
      return;
    }

    const json = await res.json();

    if (!json?.ok || !json?.data) {
    console.error("PATCH payload error:", json);
    setSavingId(null);
    alert("저장 실패");
    return;
    }

const updated = json.data;

setRows((prev) =>
  (prev ?? []).map((r) => (r?.id === id ? updated : r))
);

setSavingId(null);
  }

  function downloadCsv() {
    const header = ["created_at", "name", "phone", "status", "memo"];
    const escape = (v: any) => {
      const s = (v ?? "").toString();
      if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [
      header.join(","),
      ...rows.map((r) => header.map((k) => escape(r[k])).join(",")),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>비엔파트너스 리드 목록</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={load} disabled={loading}>새로고침</button>
          <button onClick={downloadCsv} disabled={loading || rows.length === 0}>CSV 다운로드</button>
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })}>로그아웃</button>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
        <a href="/admin/settings">설정</a>
      </div>

      {loading ? <p>불러오는 중...</p> : (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["시간", "이름", "전화", "상태", "메모", "저장"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{r.name}</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.phone}</td>

                  <td style={{ padding: "8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    <select
                      value={r.status || "NEW"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: v } : x)));
                      }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: "8px", borderBottom: "1px solid #eee", minWidth: 260 }}>
                    <input
                      value={r.memo || ""}
                      placeholder="메모"
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, memo: v } : x)));
                      }}
                      style={{ width: "100%" }}
                    />
                  </td>

                  <td style={{ padding: "8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => saveRow(r.id, r.status || "NEW", r.memo || "")}
                      disabled={savingId === r.id}
                    >
                      {savingId === r.id ? "저장중..." : "저장"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
