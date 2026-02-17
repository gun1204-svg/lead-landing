"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/admin/leads";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) router.push(callbackUrl);
    else alert("로그인 실패");
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 24 }}>
      <h1>비엔파트너스 관리자 로그인</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">로그인</button>
      </form>
    </main>
  );
}
