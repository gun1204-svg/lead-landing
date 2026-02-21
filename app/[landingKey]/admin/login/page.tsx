import AdminLoginForm from "@/components/AdminLoginForm";

export default async function Page({ params }: { params: Promise<{ landingKey: string }> }) {
  const { landingKey } = await params;
  return <AdminLoginForm landingKey={landingKey} callbackUrl={`/${landingKey}/admin/leads`} />;
}