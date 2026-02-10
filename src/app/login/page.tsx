import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { LoginPageClient } from "@/components/login/login-page-client"

function getAppUrl(): string {
  let url = process.env.NEXT_PUBLIC_APP_URL;

  if (!url) {
    // Fallback to request origin from headers
    const headersList = headers();
    const host = headersList.get("host");
    const protocol = headersList.get("x-forwarded-proto") ||
      (headersList.get("x-forwarded-ssl") === "on" ? "https" : "http");

    if (host) {
      url = `${protocol}://${host}`;
    } else {
      url = "http://localhost:3000";
    }
  }

  // Ensure no trailing slash
  return url.replace(/\/$/, "");
}

async function signInWithGoogle(formData: FormData) {
  "use server"

  const redirectTo =
    (formData.get("redirectTo") as string | null) ?? "/dashboard"
  
  const appUrl = getAppUrl()
  
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?redirectTo=${encodeURIComponent(
        redirectTo,
      )}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  })

  if (error) {
    console.error("OAuth error:", error)
    // Use absolute URL for redirect
    redirect(`${appUrl}/login?error=auth`)
  }

  if (data?.url) {
    redirect(data.url)
  }
}

type LoginPageProps = {
  searchParams?: {
    redirectTo?: string
    code?: string
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const appUrl = getAppUrl()

  if (searchParams?.code) {
    const callbackUrl = new URL("/auth/callback", appUrl)
    if (searchParams.redirectTo) {
      callbackUrl.searchParams.set("redirectTo", searchParams.redirectTo)
    }
    callbackUrl.searchParams.set("code", searchParams.code)
    redirect(callbackUrl.toString())
  }

  const redirectTo = searchParams?.redirectTo ?? "/dashboard"


  return <LoginPageClient redirectTo={redirectTo} signInAction={signInWithGoogle} />
}

