import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>불러오는 중...</div>}>
      <LoginClient />
    </Suspense>
  );
}
