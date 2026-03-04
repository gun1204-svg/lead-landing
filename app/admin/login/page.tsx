import { redirect } from "next/navigation";

export default function Page({
  searchParams,
}: {
  searchParams?: { landingKey?: string };
}) {
  const lk = String(searchParams?.landingKey ?? "00").padStart(2, "0");

  redirect(`/${lk}/admin/login`);
}