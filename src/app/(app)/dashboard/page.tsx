import { redirect } from "next/navigation"
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getOptionalUser } from "@/lib/supabase/auth"
import { getPrimaryMembership } from "@/server/queries/organizations"
import { getDashboardOverview } from "@/server/queries/dashboard"
import { cn } from "@/lib/utils"
import { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from "react"

export default async function DashboardPage() {
  const user = await getOptionalUser()
  if (!user) {
    redirect("/login")
  }

  const membership = await getPrimaryMembership(user.id)
  if (!membership) {
    redirect("/login?error=organization")
  }

  const data = await getDashboardOverview(membership.organizationId)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Stage 1 · Audit Protection
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Audit Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time HTS verification and audit readiness monitoring for{" "}
            {membership.organization.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline">Export Report</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700">
            + New Classification
          </Button>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Audit Readiness Score
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 36 36" className="h-full w-full">
                <path
                  className="text-slate-200"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="transparent"
                  d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600"
                  strokeWidth="3.8"
                  strokeDasharray={`${data.auditReadinessScore}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text
                  x="18"
                  y="20.35"
                  className="fill-slate-900 text-[0.6rem] font-semibold"
                  textAnchor="middle"
                >
                  {data.auditReadinessScore}%
                </text>
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Verified: {data.approvedCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Pending: {data.pendingCount}
              </p>
              <Badge variant="secondary" className="mt-2">
                High Trust
              </Badge>
            </div>
          </CardContent>
        </Card>
        <MetricCard
          title="Total Active Imports"
          value={data.approvedCount + data.pendingCount}
          helper="+12% YoY"
        />
        <MetricCard
          title="Missing Reasonings"
          value={data.missingReasonings}
          helper="Requires dossier coverage"
          variant="warning"
        />
        <MetricCard
          title="CBP Rulings Matched"
          value={data.rulingsMatched}
          helper="Updated weekly"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Action Required · Missing Reasoning Dossiers</CardTitle>
              <CardDescription>
                Flagged classifications that need audit-ready coverage.
              </CardDescription>
            </div>
            <Button variant="ghost" className="text-blue-600">
              View all
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product / SKU</TableHead>
                  <TableHead>HTS Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.actionItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm">
                      All classifications are covered. Great job.
                    </TableCell>
                  </TableRow>
                )}
                {data.actionItems.map((item: { id: Key | null | undefined; product: { name: any; id: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined }; htsCode: any; dossier: any }) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {item.product?.name ?? "Untitled Product"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.product?.id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.htsCode ?? (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.dossier ? "secondary" : "destructive"}
                      >
                        {item.dossier ? "Draft Incomplete" : "No Dossier"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        {item.dossier ? "Review Draft" : "Generate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Access · CBP Rulings</CardTitle>
              <CardDescription>Latest binding rulings in the vault.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.quickRulings.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No rulings synced yet. Add CROSS rulings to boost confidence.
                </p>
              )}
              {data.quickRulings.map((ruling: { id: Key | null | undefined; reference: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; title: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined }) => (
                <div
                  key={ruling.id}
                  className="rounded-xl border p-3"
                >
                  <p className="text-sm font-semibold">{ruling.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {ruling.title}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active Imports Summary</CardTitle>
              <CardDescription>Top shipments needing attention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.activeImports.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Classify a product to see shipment readiness here.
                </p>
              )}
              {data.activeImports.map((item: { id: Key | null | undefined; product: { name: any }; market: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; htsCode: any; requiresReview: any }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.product?.name ?? "Product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.market} · {item.htsCode ?? "HTS pending"}
                    </p>
                  </div>
                  <Badge
                    variant={item.requiresReview ? "destructive" : "secondary"}
                  >
                    {item.requiresReview ? "Review" : "Audit Ready"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

type MetricCardProps = {
  title: string
  value: number
  helper?: string
  variant?: "default" | "warning"
}

function MetricCard({
  title,
  value,
  helper,
  variant = "default",
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {variant === "warning" ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-blue-600" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {helper && (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              variant === "warning" && "text-amber-600",
            )}
          >
            {helper}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

