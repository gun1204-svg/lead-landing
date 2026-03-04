"use client";

import { signIn } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ⭐ URL에서 landing_key 추출
  const match = pathname.match(/^\/(\d{2})\//);
  const landingKey = match ? match[1] : "00";

  async function login() {
    await signIn("credentials", {
      email,
      password,
      landingKey: "01",
      redirect: true,
      callbackUrl: "/01/admin",
    });
  }

  return (
    <div>
      <input
        placeholder="ID"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="PW"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={login}>로그인</button>
    </div>
  );
}