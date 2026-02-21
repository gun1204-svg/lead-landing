"use client";

import { useState } from "react";

export default function Page() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      alert("이름/전화번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          landing_key: "01",
        }),
      });

      if (!res.ok) {
        alert("접수 실패");
        return;
      }

      alert("접수 완료");
      setName("");
      setPhone("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>/01 랜딩</h1>

      <div style={{ display: "grid", gap: 8 }}>
        <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="전화번호" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={submit} disabled={loading}>
          {loading ? "전송중..." : "신청하기"}
        </button>
      </div>
    </main>
  );
}