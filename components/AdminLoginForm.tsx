"use client";

import { signIn } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return null;
}

export default function AdminLoginForm({
  callbackUrl,
  landingKey,
}: {
  callbackUrl: string;
  landingKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const seg1 = pathname?.split("/")[1]; // "/01/admin/login" -> "01"
  const lk = normalizeLK(seg1) ?? normalizeLK(landingKey) ?? "00"; // ✅ pathname 우선
  const targetUrl = `/${lk}/admin/leads`; // ✅ 항상 lk로 고정

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMsg(null);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: id,
        password: pw,
        landingKey: lk,
        callbackUrl: targetUrl,
      });

      if (!res) return setMsg("로그인 응답 없음");
      if (res.error) return setMsg("로그인 실패");

      router.replace(targetUrl);
      router.refresh();
    } catch (err) {
      setMsg("로그인 예외(콘솔 확인)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
        BUILD: ADMINLOGINFORM_V2
        <br />
        pathname: {pathname}
        <br />
        seg1: {String(seg1)}
        <br />
        prop landingKey: {String(landingKey)}
        <br />
        landingKey(final): {lk}
        <br />
        targetUrl: {targetUrl}
        <br />
        (props callbackUrl: {callbackUrl})
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Admin Login</h1>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label>ID</label>
          <input value={id} onChange={(e) => setId(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </div>

        <button disabled={loading} style={{ width: "100%", padding: 12, fontWeight: 700 }}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {msg && <p style={{ marginTop: 12, color: "crimson" }}>{msg}</p>}
      </form>
    </div>
  );
}