import LandingClient from "@/components/LandingClient";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { landingKey: string } }) {
  return <LandingClient landingKey={params.landingKey} />;
}