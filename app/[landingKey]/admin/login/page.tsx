import AdminLoginForm from "@/components/AdminLoginForm";

export default function Page({ params }: { params: { landingKey: string } }) {
  const { landingKey } = params;

  return (
    <AdminLoginForm
      landingKey={landingKey}
      callbackUrl={`/${landingKey}/admin/leads`}
    />
  );
}