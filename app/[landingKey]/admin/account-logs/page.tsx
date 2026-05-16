import { Suspense } from "react";
import AccountLogsPageClient from "@/components/AccountLogsPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AccountLogsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>loading...</div>}>
      <AccountLogsPageClient />
    </Suspense>
  );
}