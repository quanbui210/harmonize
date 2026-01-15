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
  
  // Create response first so cookies can be set on it
  let response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
  
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
          response.cookies.set(name, value, options)
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
      try {
        await ensureUserWorkspace(userResponse.user)
      } catch (error) {
        // Log database error but don't block auth flow
        // User is authenticated, workspace creation can be retried later
        console.error("Failed to ensure user workspace (database may be unavailable):", error)
      }
      if (redirectTo === "/") {
        redirectTo = "/dashboard"
      }
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session && redirectTo === "/") {
    redirectTo = "/dashboard"
  }

  // Update redirect URL if it changed (preserving cookies already set)
  const finalRedirectUrl = new URL(redirectTo, requestUrl.origin).toString()
  if (response.headers.get("location") !== finalRedirectUrl) {
    response.headers.set("location", finalRedirectUrl)
  }

  return response
}

