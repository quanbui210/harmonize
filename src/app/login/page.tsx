import Link from "next/link"
import { redirect } from "next/navigation"
import { Lock } from "lucide-react"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

async function signInWithGoogle(formData: FormData) {
  "use server"

  const redirectTo =
    (formData.get("redirectTo") as string | null) ?? "/dashboard"
  const supabase = await getSupabaseServerClient()
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
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  const redirectTo = searchParams?.redirectTo ?? "/dashboard"

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden bg-gradient-to-b from-blue-900 via-blue-700 to-blue-500 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest opacity-75">
            HarmonizeAI
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">
            Audit-ready HTS intelligence in minutes.
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/80">
            Build Reasoning Dossiers, validate supplier codes, and secure
            compliance trails in one workspace.
          </p>
        </div>
        <div className="space-y-4 rounded-2xl bg-white/10 p-6 backdrop-blur">
          <p className="text-sm font-medium uppercase tracking-widest text-white/70">
            Trusted by import leaders
          </p>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/20" />
            <div>
              <p className="text-xl font-semibold">98%</p>
              <p className="text-sm text-white/80">Audit confidence score</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center px-8 py-16">
        <div className="mx-auto w-full max-w-md space-y-10">
          <div className="space-y-3 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Sign in to HarmonizeAI
            </h2>
            <p className="text-sm text-muted-foreground">
              Use your verified organization email to continue.
            </p>
          </div>
          <form action={signInWithGoogle} className="space-y-3">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button
              type="submit"
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 8.5c1.04 0 1.97.36 2.7 1.06l2-2C15.62 6.17 13.96 5.5 12 5.5A6.5 6.5 0 0 0 5.71 9.39l2.4 1.86A3.9 3.9 0 0 1 12 8.5Z"
                  fill="currentColor"
                />
                <path
                  d="M17.5 12.05c0-.37-.04-.73-.11-1.05H12v3h3.5a3 3 0 0 1-1.3 1.95l2.03 1.58C17.16 16.33 17.5 14.86 17.5 12.05Z"
                  fill="currentColor"
                />
                <path
                  d="M8.11 15.75A3.98 3.98 0 0 1 8 12c0-.45.08-.88.2-1.28l-2.4-1.87A6.49 6.49 0 0 0 5.5 12c0 1.06.26 2.06.71 2.94l1.9-1.48Z"
                  fill="currentColor"
                />
                <path
                  d="M12 18.5c1.96 0 3.61-.64 4.81-1.74l-2.03-1.58c-.56.38-1.28.62-2.12.62a3.9 3.9 0 0 1-3.88-2.91l-2.39 1.86A6.49 6.49 0 0 0 12 18.5Z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
          </form>
          <div className="space-y-4 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            <p>
              By continuing, you agree to the{" "}
              <Link href="#" className="text-primary underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>Need help?</span>
              <Link href="#" className="text-primary underline">
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

