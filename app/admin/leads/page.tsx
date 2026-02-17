"use client";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function AdminLeads() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/leads");
    if (!res.ok) {
      alert("로그인 필요");
      window.location.href = "/admin/login";
      return;
    }
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1 style={{ margin: 0 }}>비엔파트너스 리드 목록</h1>
        <div style={{ display:"flex", gap: 8 }}>
          <button onClick={load} disabled={loading}>새로고침</button>
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })}>로그아웃</button>
        </div>
      </div>

      <a href="/admin/settings">설정</a>

      {loading ? <p>불러오는 중...</p> : (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["시간","이름","전화","상태"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"8px", borderBottom:"1px solid #ddd" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ padding:"8px", borderBottom:"1px solid #eee" }}>{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #eee" }}>{r.name}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #eee" }}>{r.phone}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #eee" }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
