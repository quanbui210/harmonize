import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { UserMenu } from "./user-menu"
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher"
import { MembershipRole } from "@prisma/client"

type TopbarProps = {
  organizationName: string
  organizationId: string
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
  memberships: Array<{
    id: string
    role: MembershipRole
    organization: {
      id: string
      name: string
    }
  }>
}

export function Topbar({ organizationName, organizationId, userName, userEmail, avatarUrl, memberships }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div className="flex flex-1 items-center gap-3">
        <form action="/classify" method="get" className="relative w-full max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Search HTS codes, SKUs, dossiers..."
            className="pl-10"
          />
        </form>
      </div>
      <div className="flex items-center gap-4">
        <OrganizationSwitcher
          currentOrganizationId={organizationId}
          memberships={memberships}
        />
        <UserMenu
          userName={userName}
          userEmail={userEmail}
          organizationName={organizationName}
          avatarUrl={avatarUrl}
        />
      </div>
    </header>
  )
}

