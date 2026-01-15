import { redirect } from "next/navigation";
import { LandingContent } from "@/components/landing/landing-content";
import { getOptionalUser } from "@/lib/supabase/auth";

type LandingPageProps = {
  searchParams?: {
    code?: string;
    redirectTo?: string;
  };
};

export default async function LandingPage({ searchParams }: LandingPageProps) {
  if (searchParams?.code) {
    const redirectTo = searchParams.redirectTo || "/dashboard";
    const callbackUrl = `/auth/callback?code=${encodeURIComponent(searchParams.code)}&redirectTo=${encodeURIComponent(redirectTo)}`;
    redirect(callbackUrl);
  }

  const user = await getOptionalUser();
  const userData = user ? {
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    avatar: user.user_metadata?.avatar_url ?? null,
  } : null;

  return <LandingContent user={userData} />;
}
