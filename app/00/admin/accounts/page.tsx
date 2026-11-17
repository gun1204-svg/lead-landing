import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminAccountsClient from "@/components/AdminAccountsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/00/admin/login");

  const user = session.user as { email?: string | null; landing_key?: string | null } | undefined;
  if (user?.email !== "admin" || String(user?.landing_key ?? "").padStart(2, "0") !== "00") {
    redirect("/" + String(user?.landing_key ?? "00").padStart(2, "0") + "/admin/leads");
  }

  return <AdminAccountsClient />;
}
