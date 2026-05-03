import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/api/public", "/vault/upload", "/invite"]

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

function getCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return null
  }

  const allowedOriginPatterns = [
    /^http:\/\/localhost:\d+$/i,
    /^https:\/\/localhost:\d+$/i,
    /^http:\/\/127\.0\.0\.1:\d+$/i,
    /^https:\/\/127\.0\.0\.1:\d+$/i,
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/i,
    /^https:\/\/192\.168\.\d+\.\d+:\d+$/i,
  ]

  return allowedOriginPatterns.some((pattern) => pattern.test(origin))
    ? origin
    : null
}

function applyCorsHeaders(response: NextResponse, request: NextRequest) {
  const corsOrigin = getCorsOrigin(request)
  if (!corsOrigin) {
    return response
  }

  response.headers.set("Access-Control-Allow-Origin", corsOrigin)
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Organization-Id",
  )
  response.headers.set("Access-Control-Allow-Credentials", "true")
  response.headers.set("Vary", "Origin")

  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const hasAuthCode = searchParams.has("code")

  if (pathname.startsWith("/api/v1")) {
    if (request.method === "OPTIONS") {
      return applyCorsHeaders(new NextResponse(null, { status: 204 }), request)
    }

    return applyCorsHeaders(NextResponse.next(), request)
  }

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
  const mustChangePassword =
    session?.user?.user_metadata &&
    (session.user.user_metadata.must_change_password === true ||
      session.user.user_metadata.mustChangePassword === true)

  if (!session && !publicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(redirectUrl)
  }

  if (session && mustChangePassword && pathname !== "/change-password") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/change-password"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (session && !mustChangePassword && pathname === "/change-password") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/dashboard"
    redirectUrl.search = ""
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
    "/api/v1/:path*",
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

