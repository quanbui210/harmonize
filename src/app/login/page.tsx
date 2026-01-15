import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { LoginPageClient } from "@/components/login/login-page-client"

async function signInWithGoogle(formData: FormData) {
  "use server"

  const redirectTo =
    (formData.get("redirectTo") as string | null) ?? "/dashboard"
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?redirectTo=${encodeURIComponent(
        redirectTo,
      )}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  })

  if (error) {
    console.error(error)
    return redirect("/login?error=auth")
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

  if (searchParams?.code) {
    const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    if (searchParams.redirectTo) {
      callbackUrl.searchParams.set("redirectTo", searchParams.redirectTo)
    }
    callbackUrl.searchParams.set("code", searchParams.code)
    redirect(callbackUrl.toString())
  }

  const redirectTo = searchParams?.redirectTo ?? "/dashboard"


  return <LoginPageClient redirectTo={redirectTo} signInAction={signInWithGoogle} />
}

