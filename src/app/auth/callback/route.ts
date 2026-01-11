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
  const redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/dashboard"
  
  const cookieStore = cookies()
  const response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
  
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
      await ensureUserWorkspace(userResponse.user)
    }
  }

  return response
}

