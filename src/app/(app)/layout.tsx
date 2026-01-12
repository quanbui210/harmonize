import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { getOptionalUser } from "@/lib/supabase/auth"
import { getSelectedOrganizationId, getAllUserMemberships } from "@/server/queries/organizations"

type AppLayoutProps = {
  children: ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getOptionalUser()

  if (!user) {
    redirect("/login")
  }

  const memberships = await getAllUserMemberships(user.id)

  if (memberships.length === 0) {
    redirect("/login?error=organization")
  }

  // Format memberships for AppShell
  const formattedMemberships = memberships.map((m) => ({
    id: m.id,
    role: m.role,
    organization: {
      id: m.organization.id,
      name: m.organization.name,
    },
  }))

  // If user has multiple orgs and no selection, redirect to selection page
  if (memberships.length > 1) {
    const selectedOrgId = await getSelectedOrganizationId(user.id)
    if (!selectedOrgId) {
      redirect("/select-organization")
    }
    const membership = memberships.find((m) => m.organizationId === selectedOrgId)
    if (!membership) {
      redirect("/select-organization")
    }
    return (
      <AppShell user={user} organization={membership.organization} memberships={formattedMemberships}>
        {children}
      </AppShell>
    )
  }

  // User has only one organization
  const membership = memberships[0]
  return (
    <AppShell user={user} organization={membership.organization} memberships={formattedMemberships}>
      {children}
    </AppShell>
  )
}

