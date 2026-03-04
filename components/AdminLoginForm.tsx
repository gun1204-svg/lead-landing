"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export default function AdminLoginForm({
  callbackUrl,
  landingKey,
}: {
  callbackUrl: string;
  landingKey: string;
}) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const lk = useMemo(() => normalizeLK(landingKey), [landingKey]);

  // ✅ 절대 props callbackUrl을 믿지 말고 lk로 확정 생성
  const targetUrl = useMemo(() => `/${lk}/admin/leads`, [lk]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMsg(null);

    try {
      console.log("[LOGIN] try", { id, lk, targetUrl });

      const res = await signIn("credentials", {
        redirect: false,
        email: id,
        password: pw,
        landingKey: lk,      // ✅ 안정
        callbackUrl: targetUrl, // ✅ 여기서 undefined 방지
      });

      console.log("[LOGIN] result:", res);

      if (!res) {
        setMsg("로그인 응답이 없습니다(네트워크/스크립트 오류 가능). 콘솔/네트워크 확인.");
        return;
      }

      if (res.error) {
        setMsg("로그인 실패: 아이디/비밀번호 또는 권한(landingKey)을 확인하세요.");
        return;
      }

      // ✅ 성공 시 우리가 만든 targetUrl로 이동
      router.replace(targetUrl);

      // 세션 반영
      router.refresh();
    } catch (err: any) {
      console.error("[LOGIN] exception:", err);
      setMsg("로그인 중 예외가 발생했습니다. 콘솔 로그를 확인해주세요.");
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
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoComplete="current-password"
          />
        </div>

        <button disabled={loading} style={{ width: "100%", padding: 12, fontWeight: 700 }}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {msg && <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{msg}</p>}

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          landingKey(normalized): {lk}
          <br />
          targetUrl: {targetUrl}
          <br />
          (props callbackUrl was: {callbackUrl})
        </p>
      </form>
    </div>
  );
}