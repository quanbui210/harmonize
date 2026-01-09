import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { getOptionalUser } from "@/lib/supabase/auth"
import { getPrimaryMembership } from "@/server/queries/organizations"

type AppLayoutProps = {
  children: ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getOptionalUser()

  if (!user) {
    redirect("/login")
  }

  const membership = await getPrimaryMembership(user.id)

  if (!membership) {
    redirect("/login?error=organization")
  }

  return (
    <AppShell user={user} organization={membership.organization}>
      {children}
    </AppShell>
  )
}

