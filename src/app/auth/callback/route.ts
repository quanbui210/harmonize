import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { ensureUserWorkspace } from "@/lib/users/sync-user"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/dashboard"
  const supabase = createRouteHandlerClient({ cookies })

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    const { data: userResponse } = await supabase.auth.getUser()
    if (userResponse.user) {
      await ensureUserWorkspace(userResponse.user)
    }
  }

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
}

