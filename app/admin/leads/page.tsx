"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLeadsPage() {
  const router = useRouter();

  const sess = useSession(); // ✅ 구조분해 대신 안전하게
  const status = sess?.status;
  const session = sess?.data;

  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
      return;
    }
    if (status !== "authenticated") return;

    (async () => {
      setErr(null);
      const res = await fetch("/api/admin/leads", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(`${res.status} ${json?.error || "error"}`);
        return;
      }
      setRows(json.data || []);
    })();
  }, [status, router]);

  if (!status || status === "loading") {
    return <div style={{ padding: 20 }}>loading...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Admin Leads</h1>

      <p style={{ opacity: 0.7 }}>
        user: {(session?.user as any)?.email} / landing_key: {(session?.user as any)?.landing_key}
      </p>

      <button onClick={() => signOut({ callbackUrl: "/admin/login" })}>로그아웃</button>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <pre style={{ marginTop: 12, background: "#111", color: "#0f0", padding: 12, borderRadius: 12, overflow: "auto" }}>
        {JSON.stringify(rows.slice(0, 5), null, 2)}
      </pre>
    </div>
  );
}