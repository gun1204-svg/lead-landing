import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { landingKey: string } }) {
  const landingKey = params.landingKey;
  return (
    <AdminLoginForm
      landingKey={landingKey}
      callbackUrl={`/${landingKey}/admin/leads`}
    />
  );
}