import { redirect } from "next/navigation";

function normalizeLK(v?: string) {
  const s = String(v ?? "").trim();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  return "00";
}

export default function Page({
  searchParams,
}: {
  searchParams?: { landingKey?: string };
}) {
  const lk = normalizeLK(searchParams?.landingKey);
  redirect(`/${lk}/admin/leads`);
}