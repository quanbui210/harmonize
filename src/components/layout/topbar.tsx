import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TopbarProps = {
  organizationName: string
  userName?: string | null
  userEmail?: string | null
}

export function Topbar({ organizationName, userName, userEmail }: TopbarProps) {
  const initials =
    userName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    userEmail?.slice(0, 2).toUpperCase() ||
    "HM"

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative w-full max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search HTS codes, SKUs, dossiers..."
            className="pl-10"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{userName ?? "Analyst"}</p>
          <p className="text-xs text-muted-foreground">{organizationName}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">
          {initials}
        </div>
      </div>
    </header>
  )
}

