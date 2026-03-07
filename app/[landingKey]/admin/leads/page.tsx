import AdminLeadsClient from "@/components/AdminLeadsClient";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ landingKey: string }>;
}) {
  const { landingKey } = await params;

  return <AdminLeadsClient landingKey={landingKey} isMainAdmin={false} />;
}