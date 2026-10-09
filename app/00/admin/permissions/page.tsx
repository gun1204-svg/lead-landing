import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminLeadsClient from "@/components/AdminLeadsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const user = session?.user as {
    email?: string | null;
    landing_key?: string | null;
  } | undefined;

  if (!user?.email) {
    redirect("/00/admin/login");
  }

  if (user.email !== "admin" || user.landing_key !== "00") {
    redirect("/00/admin/login");
  }

  return <AdminLeadsClient permissionsOnly />;
}
