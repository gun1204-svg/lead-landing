"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function AdminLoginForm({
  callbackUrl,
  landingKey,
}: {
  callbackUrl: string;
  landingKey: string; // ✅ 추가
}) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    await signIn("credentials", {
      redirect: true,
      email: id,
      password: pw,
      landingKey,      // ✅ 추가 (이게 핵심)
      callbackUrl,
    });

    setLoading(false);
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

        {msg && <p style={{ marginTop: 12, color: "crimson" }}>{msg}</p>}
        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          landingKey: {landingKey} / callbackUrl: {callbackUrl}
        </p>
      </form>
    </div>
  );
}