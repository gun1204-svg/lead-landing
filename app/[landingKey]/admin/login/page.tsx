import AdminLoginForm from "@/components/AdminLoginForm";

function normalizeLK(v: string) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export default function Page({ params }: { params: { landingKey: string } }) {
  const landingKey = normalizeLK(params.landingKey);

  return (
    <AdminLoginForm
      landingKey={landingKey}
      callbackUrl={`/${landingKey}/admin/leads`}
    />
  );
}