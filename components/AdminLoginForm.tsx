"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMsg(null);

    try {
      console.log("[LOGIN] try", { id, landingKey, callbackUrl });

      const res = await signIn("credentials", {
        redirect: false, // ✅ 핵심: 리다이렉트 끄고 결과를 받는다
        email: id,
        password: pw,
        landingKey,      // 너가 추가했던 값(있어도 되고 없어도 됨)
        callbackUrl,
      });

      console.log("[LOGIN] result:", res);

      if (!res) {
        setMsg("로그인 응답이 없습니다(네트워크/스크립트 오류 가능). 콘솔/네트워크 확인.");
        return;
      }

      if (res.error) {
        // NextAuth는 실패하면 여기로 들어옴
        setMsg(`로그인 실패: ${res.error}`);
        return;
      }

      // 성공 시 res.url 로 이동 (없으면 callbackUrl로)
      router.push(res.url ?? callbackUrl);
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
        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          landingKey: {landingKey} / callbackUrl: {callbackUrl}
        </p>
      </form>
    </div>
  );
}