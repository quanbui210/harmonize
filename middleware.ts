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
  const { pathname, searchParams } = request.nextUrl
  const hasAuthCode = searchParams.has("code")


  if (hasAuthCode && pathname !== "/auth/callback") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/auth/callback"

    if (!redirectUrl.searchParams.has("redirectTo")) {
      redirectUrl.searchParams.set("redirectTo", "/dashboard")
    }
    return NextResponse.redirect(redirectUrl)
  }

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

  const publicRoute = isPublicPath(pathname)

  if (!session && !publicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(redirectUrl)
  }

  // Don't redirect /login here - let the client component handle it
  // This allows the loading screen to show immediately instead of a white screen
  // if (session && pathname === "/login") {
  //   const redirectUrl = request.nextUrl.clone()
  //   redirectUrl.pathname = "/dashboard"
  //   redirectUrl.search = ""
  //   return NextResponse.redirect(redirectUrl)
  // }

  if (session && pathname === "/") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/dashboard"
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files with extensions (e.g., .png, .jpg, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
}

