import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminInfluencersClient from "@/components/AdminInfluencersClient";

export const dynamic = "force-dynamic";

export default async function InternalInfluencersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/internal/login?callbackUrl=/internal/influencers");
  }

  if ((session.user as any).role !== "internal") {
    redirect("/internal/login?callbackUrl=/internal/influencers");
  }

  return <AdminInfluencersClient apiBase="/api/internal/influencers" />;
}