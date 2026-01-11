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
import Link from "next/link"
import { DeleteClassificationButton } from "@/components/classification/delete-classification-button"

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

function formatHTSCode(htsCode: string): string {
  if (!htsCode || htsCode.length !== 10) return htsCode;
  return `${htsCode.substring(0, 4)}.${htsCode.substring(4, 6)}.${htsCode.substring(6, 8)}.${htsCode.substring(8, 10)}`;
}

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
          <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
            <Link href="/classify">+ New Classification</Link>
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
              <CardTitle>Recent Classifications</CardTitle>
              <CardDescription>
                Latest product classifications and their dossier status.
              </CardDescription>
            </div>
            <Button variant="ghost" className="text-blue-600" asChild>
              <Link href="/classify">View all</Link>
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
                {data.actionItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
                      <Link href={`/classify/${item.id}`} className="block">
                        <div className="min-w-0">
                          <p 
                            className="font-medium truncate cursor-help" 
                            title={item.product?.name ?? "Untitled Product"}
                          >
                            {item.product?.name ?? "Untitled Product"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {String(item.product?.id ?? "")}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/classify/${item.id}`} className="block">
                        {item.htsCode && item.htsCode !== "0000000000" ? (
                          <div className="space-y-1">
                            <p className="font-mono text-sm">
                              {formatHTSCode(item.htsCode)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              CN: {formatCNCode(item.htsCode.substring(0, 8))}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Pending classification</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/classify/${item.id}`} className="block">
                        <Badge
                          variant={item.dossier ? "default" : "destructive"}
                        >
                          {item.dossier ? "Dossier Ready" : "No Dossier"}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          asChild
                        >
                          <Link href={item.dossier 
                            ? `/classify/${item.id}/dossier` 
                            : `/classify/${item.id}`}
                          >
                            {item.dossier ? "View Dossier" : "View Details"}
                          </Link>
                        </Button>
                        <DeleteClassificationButton
                          classificationId={item.id}
                          productName={item.product?.name ?? "Untitled Product"}
                        />
                      </div>
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
              {data.quickRulings.map((ruling) => (
                <div
                  key={String(ruling.id)}
                  className="rounded-xl border p-3"
                >
                  <p className="text-sm font-semibold">{String(ruling.reference ?? "")}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(ruling.title ?? "")}
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
              {data.activeImports.map((item) => (
                <div
                  key={String(item.id)}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.product?.name ?? "Product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item.market ?? "")} · {item.htsCode ? formatHTSCode(item.htsCode) : "HTS pending"}
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

