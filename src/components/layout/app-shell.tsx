import type { ReactNode } from "react"
import type { Organization } from "@prisma/client"
import type { User } from "@supabase/supabase-js"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"

type AppShellProps = {
  user: User
  organization: Organization
  children: ReactNode
}

export function AppShell({ user, organization, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar organizationName={organization.name} />
      <div className="flex flex-1 flex-col">
        <Topbar
          organizationName={organization.name}
          userName={
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email
          }
          userEmail={user.email}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  )
}

