import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { ensureUserWorkspace } from "@/lib/users/sync-user"

const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured")
  }
  return url
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured")
  }
  return key
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  let redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/dashboard"
  
  // Never redirect authenticated users to the landing page
  if (redirectTo === "/") {
    redirectTo = "/dashboard"
  }
  
  const cookieStore = cookies()
  
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("Error exchanging code for session:", error)
      return NextResponse.redirect(new URL("/login?error=auth", requestUrl.origin))
    }
    
    const { data: userResponse } = await supabase.auth.getUser()
    if (userResponse.user) {
      await ensureUserWorkspace(userResponse.user)
      if (redirectTo === "/") {
        redirectTo = "/dashboard"
      }
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session && redirectTo === "/") {
    redirectTo = "/dashboard"
  }

  const response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin))

  return response
}

