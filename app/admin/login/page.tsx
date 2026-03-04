"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function getLandingKey() {
    const path = window.location.pathname;

    const match = path.match(/^\/(\d{2})\//);

    if (match) return match[1];

    return "00";
  }

  async function login() {
    const landingKey = getLandingKey();

    await signIn("credentials", {
      email,
      password,
      landingKey,
      redirect: true,
      callbackUrl: landingKey === "00"
        ? "/admin"
        : `/${landingKey}/admin`,
    });
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Admin Login</h1>

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