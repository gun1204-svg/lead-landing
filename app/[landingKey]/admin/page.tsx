import { redirect } from "next/navigation";

export default function LandingAdminEntry({
  params,
}: {
  params: { landingKey: string };
}) {
  redirect(`/${params.landingKey}/admin/login`);
}