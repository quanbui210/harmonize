"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlertTriangle,
  BookOpenCheck,
  Box,
  FileText,
  FlaskConical,
  Home,
  LifeBuoy,
  MessageSquare,
  Settings,
  ShieldCheck,
  Waypoints,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MembershipRole } from "@prisma/client"
import { UserMenu } from "./user-menu"
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher"

const primaryNav = [
  {
    label: "Audit Dashboard",
    href: "/dashboard",
    icon: ShieldCheck,
  },
  {
    label: "Classify & Search",
    href: "/classify",
    icon: FlaskConical,
  },
  {
    label: "Product Labels",
    href: "/labels",
    icon: Waypoints,
  },
  {
    label: "Compliance Vault",
    href: "/vault",
    icon: FileText,
  },
  {
    label: "Compliance Q&A",
    href: "/compliance-chat",
    icon: MessageSquare,
  },
  {
    label: "Ruling Database",
    href: "/rulings",
    icon: BookOpenCheck,
  },
  {
    label: "Defense Dossiers",
    href: "/dossiers",
    icon: FileText,
  },
]

const secondaryNav = [
  {
    label: "Shipments",
    href: "/shipments",
    icon: Box,
  },
  {
    label: "Audit Log",
    href: "/audit-log",
    icon: AlertTriangle,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "Support Center",
    href: "/support",
    icon: LifeBuoy,
  },
]

type SidebarProps = {
  organizationId: string
  organizationName: string
  organizationLogoUrl?: string | null
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

export function Sidebar({
  organizationId,
  organizationName,
  organizationLogoUrl,
  userName,
  userEmail,
  avatarUrl,
  memberships,
}: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r bg-white px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <Home className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-serif font-bold tracking-tight">
            Tulli<span className="text-primary">Check</span>
          </p>
          <div className="flex items-center gap-2">
            {organizationLogoUrl ? (
              <>
                <img
                  src={organizationLogoUrl}
                  alt={organizationName}
                  className="h-4 w-4 rounded object-cover"
                />
                <p className="text-xs text-muted-foreground truncate">{organizationName}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground truncate">{organizationName}</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <nav className="space-y-1">
            {primaryNav.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-6">
            <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
              Quick actions
            </p>
            <div className="mt-3 space-y-2">
              <Button 
                className="w-full justify-start gap-2"
                asChild
              >
                <Link href="/classify">
                  <FlaskConical className="h-4 w-4" />
                  New Classification
                </Link>
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start gap-2 bg-slate-600 text-white hover:bg-slate-500"
                asChild
              >
                <Link href="/labels/new">
                  <Waypoints className="h-4 w-4" />
                  New Label
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                asChild
              >
                <Link href="/vault">
                  <FileText className="h-4 w-4" />
                  Request Docs
                </Link>
              </Button>
            </div>
          </div>
          <nav className="mt-6 space-y-1 border-t pt-4">
            {secondaryNav.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="border-t bg-white pt-4">
          <div className="space-y-2 px-1">
            <OrganizationSwitcher
              currentOrganizationId={organizationId}
              memberships={memberships}
            />
            <UserMenu
              userName={userName}
              userEmail={userEmail}
              organizationName={organizationName}
              avatarUrl={avatarUrl}
              direction="up"
            />
          </div>
        </div>
      </div>
    </aside>
  )
}

