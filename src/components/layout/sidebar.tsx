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
  ShieldCheck,
  Waypoints,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const primaryNav = [
  {
    label: "Audit Dashboard",
    href: "/dashboard",
    icon: ShieldCheck,
  },
  {
    label: "Classification Lab",
    href: "/classification-lab",
    icon: FlaskConical,
  },
  {
    label: "Compliance Vault",
    href: "/compliance-vault",
    icon: FileText,
  },
  {
    label: "Ruling Database",
    href: "/rulings",
    icon: BookOpenCheck,
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
    label: "Support Center",
    href: "/support",
    icon: LifeBuoy,
  },
]

type SidebarProps = {
  organizationName: string
}

export function Sidebar({ organizationName }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 flex-col border-r bg-white px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <Home className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">HarmonizeAI</p>
          <p className="text-xs text-muted-foreground">{organizationName}</p>
        </div>
      </div>
      <div className="mt-8 space-y-6">
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
        <div>
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            Quick actions
          </p>
          <div className="mt-3 space-y-2">
            <Button className="w-full justify-start gap-2">
              <Waypoints className="h-4 w-4" />
              New Classification
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" />
              Request Docs
            </Button>
          </div>
        </div>
        <nav className="space-y-1 border-t pt-4">
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
    </aside>
  )
}

