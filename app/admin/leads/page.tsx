import { Suspense } from "react";
import AdminLeadsClient from "./AdminLeadsClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>loading...</div>}>
      <AdminLeadsClient />
    </Suspense>
  );
}