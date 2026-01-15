import { redirect } from "next/navigation";
import { LandingContent } from "@/components/landing/landing-content";

type LandingPageProps = {
  searchParams?: {
    code?: string;
    redirectTo?: string;
  };
};

export default function LandingPage({ searchParams }: LandingPageProps) {
  if (searchParams?.code) {
    const redirectTo = searchParams.redirectTo || "/dashboard";
    const callbackUrl = `/auth/callback?code=${encodeURIComponent(searchParams.code)}&redirectTo=${encodeURIComponent(redirectTo)}`;
    redirect(callbackUrl);
  }

  return <LandingContent />;
}
