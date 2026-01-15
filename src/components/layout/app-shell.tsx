import type { ReactNode } from "react"
import type { Organization, Membership, MembershipRole } from "@prisma/client"
import type { User } from "@supabase/supabase-js"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { Toaster } from "@/components/ui/toaster"

type AppShellProps = {
  user: User
  organization: Organization
  memberships: Array<{
    id: string
    role: MembershipRole
    organization: {
      id: string
      name: string
    }
  }>
  children: ReactNode
}

export function AppShell({ user, organization, memberships, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        organizationName={organization.name}
        organizationLogoUrl={organization.logoUrl}
      />
      <div className="flex flex-1 flex-col">
        <Topbar
          organizationName={organization.name}
          organizationId={organization.id}
          userName={
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email
          }
          userEmail={user.email}
          avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}
          memberships={memberships}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-10">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}

