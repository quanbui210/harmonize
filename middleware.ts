import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/api/public", "/vault/upload"]

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

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon")
  )
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set({ name, value, ...options })
        })
      },
    },
  })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname, searchParams } = request.nextUrl
  const publicRoute = isPublicPath(pathname)
  const hasAuthCode = searchParams.has("code")

  // Redirect to callback if we have an auth code but no session
  // This handles cases where OAuth redirects to / instead of /auth/callback
  if (!session && hasAuthCode && pathname !== "/auth/callback") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/auth/callback"
    // Preserve all search params (code, redirectTo, etc.)
    return NextResponse.redirect(redirectUrl)
  }

  if (!session && !publicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(redirectUrl)
  }

  if (session && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/dashboard"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (session && pathname === "/") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/dashboard"
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!.*\\.[\\w]+$|_next).*)", "/"],
}

