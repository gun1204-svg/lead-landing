import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

function normalizeLK(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export default function Page({ params }: { params: { landingKey: string } }) {
  const lk = normalizeLK(params.landingKey);

  return (
    <AdminLoginForm
      landingKey={lk}
      callbackUrl={`/${lk}/admin/leads`}
    />
  );
}