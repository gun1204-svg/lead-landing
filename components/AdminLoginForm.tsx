"use client";

import { signIn } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname(); // ✅ 핵심: 현재 URL을 Next가 아는 값으로 받기

  const seg1 = pathname?.split("/")[1]; // "/01/admin/login" -> "01"
  const lk = normalizeLK(landingKey) ?? normalizeLK(seg1) ?? "00";

  // ✅ callbackUrl도 props 믿지 말고 lk로 확정
  const targetUrl = `/${lk}/admin/leads`;

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

      if (!res) {
        setMsg("로그인 응답이 없습니다(네트워크/스크립트 오류).");
        return;
      }
      if (res.error) {
        setMsg("로그인 실패: 아이디/비밀번호 또는 권한(landingKey) 확인");
        return;
      }

      router.replace(targetUrl);
      router.refresh();
    } catch (err) {
      setMsg("로그인 중 예외 발생. 콘솔 확인");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
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

        {msg && <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{msg}</p>}

        {/* ✅ 디버그: 이 3줄이 진짜 원인을 바로 보여줌 */}
        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          pathname: {pathname}
          <br />
          prop landingKey: {String(landingKey)}
          <br />
          landingKey(final): {lk} / targetUrl: {targetUrl}
        </p>
      </form>
    </div>
  );
}